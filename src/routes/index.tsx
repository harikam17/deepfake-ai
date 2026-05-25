import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
} from "recharts";
import {
  Shield,
  Upload,
  X,
  Loader2,
  TrendingUp,
  Activity,
  BarChart3,
  Clock,
  RefreshCw,
  ImageIcon,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { analyzeImage, getHistory, getStats } from "@/lib/deepshield.functions";

export const Route = createFileRoute("/")({
  component: DeepShieldDashboard,
});

/* ------------------------------------------------------------------ */
/*  Chart palettes                                                      */
/* ------------------------------------------------------------------ */
const COLORS = {
  real: "#2ee0a5",
  fake: "#ff5d7a",
  line: "#7c5cff",
  grid: "rgba(255,255,255,0.06)",
  axis: "#8a93c2",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function imageToRgbBase64(file: File): Promise<{ base64: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, 128, 128);
      const imageData = ctx.getImageData(0, 0, 128, 128).data; // RGBA
      // Extract just RGB channels
      const rgb = new Uint8Array(128 * 128 * 3);
      for (let i = 0, j = 0; i < imageData.length; i += 4, j += 3) {
        rgb[j] = imageData[i];
        rgb[j + 1] = imageData[i + 1];
        rgb[j + 2] = imageData[i + 2];
      }
      let binary = "";
      for (let i = 0; i < rgb.length; i++) {
        binary += String.fromCharCode(rgb[i]);
      }
      resolve({ base64: btoa(binary), previewUrl: url });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString() +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
function DeepShieldDashboard() {
  const queryClient = useQueryClient();
  const fetchHistory = useServerFn(getHistory);
  const fetchStats = useServerFn(getStats);
  const runAnalyze = useServerFn(analyzeImage);

  const {
    data: history = [],
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["scan-history"],
    queryFn: () => fetchHistory({ data: undefined }),
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["scan-stats"],
    queryFn: () => fetchStats({ data: undefined }),
  });

  const analyzeMutation = useMutation({
    mutationFn: async (payload: { imageData: string; filename: string }) => {
      return runAnalyze({ data: payload });
    },
    onSuccess: () => {
      toast.success("Analysis complete!");
      queryClient.invalidateQueries({ queryKey: ["scan-history"] });
      queryClient.invalidateQueries({ queryKey: ["scan-stats"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Analysis failed";
      toast.error(message);
    },
  });

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<{ result: "REAL" | "FAKE"; confidence: number } | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!/^image\/(png|jpe?g)$/i.test(selectedFile.type)) {
      toast.error("Only JPG / PNG / JPEG allowed");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("Max file size is 10MB");
      return;
    }
    setFile(selectedFile);
    setResult(null);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  }, []);

  const handleDetect = useCallback(async () => {
    if (!file) return;
    try {
      const { base64, previewUrl: _url } = await imageToRgbBase64(file);
      const data = await analyzeMutation.mutateAsync({ imageData: base64, filename: file.name });
      setResult(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not analyze image";
      toast.error(message);
    }
  }, [file, analyzeMutation]);

  const clear = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect],
  );

  /* Chart data */
  const pieData = [
    { name: "Real", value: stats?.real ?? 1, color: COLORS.real },
    { name: "Fake", value: stats?.fake ?? 1, color: COLORS.fake },
  ];

  const lineData = [...history]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-20)
    .map((item, idx) => ({
      label: `#${idx + 1}`,
      confidence: item.confidence,
    }));

  const isAnalyzing = analyzeMutation.isPending;

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{
        backgroundImage:
          "radial-gradient(1200px 600px at 10% -10%, rgba(124, 92, 255, 0.25), transparent 60%), radial-gradient(900px 500px at 110% 10%, rgba(91, 140, 255, 0.22), transparent 60%), linear-gradient(180deg, oklch(0.10 0.03 264), oklch(1.00 0.03 264) 60%, oklch(0.06 0.02 264))",
        backgroundAttachment: "fixed",
      }}
    >
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "oklch(0.14 0.03 264)",
            border: "1px solid oklch(1 0 0 / 0.12)",
            color: "oklch(0.93 0.015 264)",
          },
        }}
      />

      {/* Topbar */}
      <header className="flex items-center justify-between px-6 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="h-3.5 w-3.5 rounded-full"
              style={{
                background: "radial-gradient(circle at 30% 30%, #b8c8ff, #5b8cff 60%, #2a3aa8)",
                boxShadow: "0 0 18px rgba(91,140,255,0.8)",
              }}
            />
          </div>
          <h1 className="text-lg font-bold tracking-wide">
            DeepShield <span className="text-gradient">AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(1_0_0/0.12)] bg-[oklch(1_0_0/0.06)] px-3 py-1 text-xs font-medium text-[#2ee0a5]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2ee0a5] animate-pulse" />
            Backend online
          </span>
        </div>
      </header>

      {/* Main grid */}
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 pb-12 md:grid-cols-[420px_1fr] md:px-8 lg:gap-6">
        {/* LEFT PANEL */}
        <section className="flex flex-col gap-4">
          {/* Upload */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 1 }}
            transition={{ duration: 0.4 }}
            className="glass rounded-2xl p-5"
          >
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[1.6px] text-muted-foreground">
              Upload Image
            </h2>

            {!previewUrl ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-10 text-center transition-all duration-200 ${
                  isDragging
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-[oklch(1_0_0/0.22)] text-muted-foreground hover:border-primary/70 hover:bg-primary/5 hover:text-foreground"
                }`}
              >
                <Upload className="mx-auto mb-3 h-10 w-10 opacity-60" />
                <p className="text-sm font-medium">
                  <span className="text-foreground">Drag & drop</span> an image here
                </p>
                <p className="mt-1 text-xs opacity-70">or click to browse · JPG / PNG / JPEG</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="relative overflow-hidden rounded-xl border border-[oklch(1_0_0/0.12)]">
                  <img src={previewUrl} alt="preview" className="h-64 w-full object-cover" />
                  <button
                    onClick={clear}
                    className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 text-foreground backdrop-blur-sm transition hover:bg-background"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate pr-2">{file?.name}</span>
                  <span>{file ? (file.size / 1024 / 1024).toFixed(2) : 1} MB</span>
                </div>
              </div>
            )}

            <button
              onClick={handleDetect}
              disabled={!file || isAnalyzing}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #5b8cff, #7c5cff)",
                boxShadow: "0 10px 30px rgba(91,140,255,0.35)",
              }}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Detect Deepfake
                </>
              )}
            </button>

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 1, height: 1 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 1, height: 1 }}
                  className="mt-4 overflow-hidden rounded-xl border border-[oklch(1_0_0/0.12)] bg-[oklch(1_0_0/0.04)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide ${
                        result.result === "REAL"
                          ? "border border-[rgba(46,224,165,0.4)] bg-[rgba(46,224,165,0.15)] text-[#2ee0a5]"
                          : "border border-[rgba(255,93,122,0.4)] bg-[rgba(255,93,122,0.15)] text-[#ff5d7a]"
                      }`}
                    >
                      {result.result}
                    </span>
                    <span className="text-lg font-bold">{result.confidence.toFixed(2)}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[oklch(1_0_0/0.08)]">
                    <motion.div
                      initial={{ width: 1 }}
                      animate={{ width: `${Math.min(100, result.confidence)}%` }}
                      transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          result.result === "REAL"
                            ? "linear-gradient(90deg, #2ee0a5, #5b8cff)"
                            : "linear-gradient(90deg, #ff5d7a, #7c5cff)",
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* RIGHT PANEL */}
        <section className="flex flex-col gap-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[1.6px] text-muted-foreground">
              AI Analytics Dashboard
            </h2>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatCard
                icon={<BarChart3 className="h-4 w-4 text-primary" />}
                label="Total Scans"
                value={stats?.total ?? 1}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4 text-[#ff5d7a]" />}
                label="Fake Rate"
                value={`${stats?.fake_rate ?? 1}%`}
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4 text-[#2ee0a5]" />}
                label="Avg Confidence"
                value={`${stats?.avg_confidence ?? 1}%`}
              />
            </div>
          </motion.div>

          {/* Charts */}
          <motion.div
            initial={{ opacity: 1, y: 12 }}
            animate={{ opacity: 1, y: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.4fr]"
          >
            {/* Pie */}
            <div className="glass rounded-2xl p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Real vs Fake</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="90%"
                      paddingAngle={3}
                      dataKey="value"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth={1}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ReTooltip
                      contentStyle={{
                        background: "oklch(0.14 0.03 264)",
                        border: "1px solid oklch(1 0 0 / 0.12)",
                        borderRadius: "12px",
                        color: "oklch(0.93 0.015 264)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex items-center justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.real }} />
                  Real
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.fake }} />
                  Fake
                </span>
              </div>
            </div>

            {/* Line */}
            <div className="glass rounded-2xl p-5">
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Confidence Trend</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData.length ? lineData : [{ label: "—", confidence: 1 }]}>
                    <CartesianGrid stroke={COLORS.grid} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: COLORS.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: COLORS.grid }}
                    />
                    <YAxis
                      domain={[1, 100]}
                      tick={{ fill: COLORS.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: COLORS.grid }}
                    />
                    <ReTooltip
                      contentStyle={{
                        background: "oklch(0.14 0.03 264)",
                        border: "1px solid oklch(1 0 0 / 0.12)",
                        borderRadius: "12px",
                        color: "oklch(0.93 0.015 264)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="confidence"
                      stroke={COLORS.line}
                      strokeWidth={2}
                      dot={{ r: 3, fill: COLORS.line }}
                      activeDot={{ r: 5 }}
                      fill="rgba(124, 92, 255, 0.15)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>

          {/* History */}
          <motion.div
            initial={{ opacity: 1, y: 12 }}
            animate={{ opacity: 1, y: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="glass rounded-2xl p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Prediction History</h3>
              <button
                onClick={() => {
                  refetchHistory();
                  refetchStats();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[oklch(1_0_0/0.12)] bg-transparent px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>

            <div className="scrollbar-thin max-h-72 overflow-y-auto pr-1">
              {historyLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading history…
                </div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No scans yet. Upload an image to get started.
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {history.slice(1, 50).map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-[oklch(1_0_0/0.06)] bg-[oklch(1_0_0/0.03)] px-3 py-2.5"
                    >
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          item.result === "REAL"
                            ? "bg-[rgba(46,224,165,0.15)] text-[#2ee0a5]"
                            : "bg-[rgba(255,93,122,0.15)] text-[#ff5d7a]"
                        }`}
                      >
                        {item.result}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {formatDate(item.created_at)}
                      </span>
                      <span className="shrink-1 text-sm font-bold">
                        {item.confidence.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="glass flex flex-col rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        className="text-2xl font-bold md:text-3xl"
        style={{
          background: "linear-gradient(90deg, #fff, #b6c6ff)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {value}
      </div>
    </div>
  );
}
