/* DeepShield AI - frontend logic */
const API_BASE_URL = "http://127.0.0.1:5000"; // change to your deployed backend URL
const LS_KEY = "deepshield_history_v1";

const $ = (id) => document.getElementById(id);
const dropzone = $("dropzone");
const fileInput = $("file-input");
const previewCard = $("preview-card");
const previewImg = $("preview-img");
const previewName = $("preview-name");
const clearBtn = $("clear-btn");
const detectBtn = $("detect-btn");
const btnSpinner = detectBtn.querySelector(".spinner");
const resultArea = $("result-area");
const resultBadge = $("result-badge");
const resultConf = $("result-conf");
const resultBar = $("result-bar");
const apiStatus = $("api-status");
const refreshBtn = $("refresh-btn");

let currentFile = null;
let pieChart, lineChart;

/* ---------- toast ---------- */
function toast(msg, type = "") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast " + type;
  setTimeout(() => t.classList.add("hidden"), 50);
  setTimeout(() => {
    t.classList.remove("hidden");
  }, 60);
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => t.classList.add("hidden"), 3200);
}

/* ---------- local history fallback ---------- */
function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}
function saveLocal(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {}
}
function pushLocal(entry) {
  const items = loadLocal();
  items.push(entry);
  saveLocal(items);
}

/* ---------- API ---------- */
async function ping() {
  try {
    const r = await fetch(`${API_BASE_URL}/`, { method: "GET" });
    if (!r.ok) throw new Error();
    apiStatus.textContent = "Backend online";
    apiStatus.className = "pill ok";
    return true;
  } catch {
    apiStatus.textContent = "Offline · using local history";
    apiStatus.className = "pill bad";
    return false;
  }
}

async function fetchHistory() {
  try {
    const r = await fetch(`${API_BASE_URL}/history`);
    if (!r.ok) throw new Error();
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return loadLocal().sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  }
}

async function predict(file) {
  const fd = new FormData();
  fd.append("image", file);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      body: fd,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------- upload UX ---------- */
function setFile(file) {
  if (!file) return;
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) {
    toast("Only JPG / PNG / JPEG allowed", "error");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    toast("Max file size is 10MB", "error");
    return;
  }
  currentFile = file;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewName.textContent = file.name;
  previewCard.classList.remove("hidden");
  detectBtn.disabled = false;
  resultArea.classList.add("hidden");
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", (e) => setFile(e.target.files[0]));
["dragenter", "dragover"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  }),
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  }),
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files?.[0];
  setFile(file);
});

clearBtn.addEventListener("click", () => {
  currentFile = null;
  fileInput.value = "";
  previewCard.classList.add("hidden");
  resultArea.classList.add("hidden");
  detectBtn.disabled = true;
});

/* ---------- detect ---------- */
detectBtn.addEventListener("click", async () => {
  if (!currentFile) return;
  detectBtn.disabled = true;
  btnSpinner.classList.remove("hidden");
  detectBtn.querySelector(".btn-label").textContent = "Analyzing…";
  try {
    const data = await predict(currentFile);
    showResult(data);
    pushLocal({
      result: data.result,
      confidence: data.confidence,
      timestamp: data.timestamp || new Date().toISOString(),
      filename: currentFile.name,
    });
    toast("Analysis complete", "success");
    await refreshDashboard();
  } catch (err) {
    console.error(err);
    toast(err.message || "Prediction failed. Is the backend running?", "error");
  } finally {
    btnSpinner.classList.add("hidden");
    detectBtn.querySelector(".btn-label").textContent = "Detect Deepfake";
    detectBtn.disabled = false;
  }
});

function showResult({ result, confidence }) {
  const isReal = result === "REAL";
  resultArea.classList.remove("hidden");
  resultBadge.textContent = result;
  resultBadge.className = "badge " + (isReal ? "real" : "fake");
  resultConf.textContent = `${Number(confidence).toFixed(2)}%`;
  requestAnimationFrame(() => {
    resultBar.style.width = `${Math.min(100, Number(confidence))}%`;
    resultBar.style.background = isReal
      ? "linear-gradient(90deg, #2ee0a5, #5b8cff)"
      : "linear-gradient(90deg, #ff5d7a, #7c5cff)";
  });
}

/* ---------- dashboard ---------- */
function computeStats(items) {
  const total = items.length;
  const fake = items.filter((i) => i.result === "FAKE").length;
  const real = total - fake;
  const fakeRate = total ? (fake / total) * 100 : 0;
  const avg = total ? items.reduce((s, i) => s + Number(i.confidence || 0), 0) / total : 0;
  return { total, real, fake, fakeRate, avg };
}

function renderStats(s) {
  $("stat-total").textContent = s.total;
  $("stat-fake-rate").textContent = `${s.fakeRate.toFixed(1)}%`;
  $("stat-avg").textContent = `${s.avg.toFixed(1)}%`;
}

function renderHistory(items) {
  const list = $("history-list");
  list.innerHTML = "";
  if (!items.length) {
    list.innerHTML = `<li class="empty">No scans yet. Upload an image to get started.</li>`;
    return;
  }
  items.slice(0, 50).forEach((it) => {
    const li = document.createElement("li");
    const isReal = it.result === "REAL";
    const ts = it.timestamp ? new Date(it.timestamp).toLocaleString() : "—";
    li.innerHTML = `
      <span class="h-badge ${isReal ? "real" : "fake"}">${it.result || "—"}</span>
      <span class="h-ts">${ts}</span>
      <span class="h-conf">${Number(it.confidence || 0).toFixed(1)}%</span>
    `;
    list.appendChild(li);
  });
}

function renderCharts(items) {
  const s = computeStats(items);
  // pie
  const pieData = {
    labels: ["Real", "Fake"],
    datasets: [
      {
        data: [s.real, s.fake],
        backgroundColor: ["rgba(46,224,165,.85)", "rgba(255,93,122,.85)"],
        borderColor: "rgba(255,255,255,.08)",
        borderWidth: 1,
      },
    ],
  };
  if (!pieChart) {
    pieChart = new Chart($("pie-chart"), {
      type: "doughnut",
      data: pieData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        plugins: { legend: { labels: { color: "#cfd6ff" } } },
      },
    });
  } else {
    pieChart.data = pieData;
    pieChart.update();
  }
  // line - chronological
  const chrono = [...items].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
  const labels = chrono.map((_, i) => `#${i + 1}`);
  const values = chrono.map((i) => Number(i.confidence || 0));
  const lineData = {
    labels,
    datasets: [
      {
        label: "Confidence",
        data: values,
        borderColor: "rgba(124, 92, 255, 1)",
        backgroundColor: "rgba(124, 92, 255, .2)",
        tension: 0.35,
        fill: true,
        pointRadius: 3,
      },
    ],
  };
  if (!lineChart) {
    lineChart = new Chart($("line-chart"), {
      type: "line",
      data: lineData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: "#8a93c2" }, grid: { color: "rgba(255,255,255,.05)" } },
          y: {
            min: 0,
            max: 100,
            ticks: { color: "#8a93c2" },
            grid: { color: "rgba(255,255,255,.05)" },
          },
        },
        plugins: { legend: { labels: { color: "#cfd6ff" } } },
      },
    });
  } else {
    lineChart.data = lineData;
    lineChart.update();
  }
}

async function refreshDashboard() {
  const items = await fetchHistory();
  renderStats(computeStats(items));
  renderHistory(items);
  renderCharts(items);
}

refreshBtn.addEventListener("click", refreshDashboard);

/* ---------- boot ---------- */
(async function init() {
  await ping();
  await refreshDashboard();
})();
