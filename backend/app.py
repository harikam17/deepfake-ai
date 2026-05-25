"""DeepShield AI - Flask backend for deepfake detection."""
import json
import os
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import io

from utils import analyze_image

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

HISTORY_FILE = os.path.join(os.path.dirname(__file__), "history.json")
ALLOWED_EXT = {"png", "jpg", "jpeg"}
MAX_BYTES = 10 * 1024 * 1024  # 10MB


def _load_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_history(items):
    try:
        with open(HISTORY_FILE, "w") as f:
            json.dump(items, f, indent=2)
    except Exception as e:
        print("History save failed:", e)


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


@app.route("/", methods=["GET"])
def index():
    return jsonify({"name": "DeepShield AI", "status": "ok"})


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded. Use form field 'image'."}), 400

    file = request.files["image"]
    if not file or file.filename == "":
        return jsonify({"error": "Empty filename."}), 400
    if not _allowed(file.filename):
        return jsonify({"error": "Invalid file type. Use JPG/PNG/JPEG."}), 400

    raw = file.read()
    if len(raw) > MAX_BYTES:
        return jsonify({"error": "File too large (max 10MB)."}), 400

    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        return jsonify({"error": "Could not read image."}), 400

    try:
        result, confidence = analyze_image(img)
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {e}"}), 500

    entry = {
        "result": result,
        "confidence": confidence,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "filename": file.filename,
    }
    history = _load_history()
    history.append(entry)
    _save_history(history)

    return jsonify({"result": result, "confidence": confidence, "timestamp": entry["timestamp"]})


@app.route("/history", methods=["GET"])
def history():
    items = _load_history()
    items_sorted = sorted(items, key=lambda x: x.get("timestamp", ""), reverse=True)
    return jsonify(items_sorted)


@app.route("/stats", methods=["GET"])
def stats():
    items = _load_history()
    total = len(items)
    fakes = sum(1 for i in items if i.get("result") == "FAKE")
    reals = total - fakes
    fake_rate = round((fakes / total) * 100, 2) if total else 0.0
    avg_conf = round(sum(i.get("confidence", 0) for i in items) / total, 2) if total else 0.0
    return jsonify({
        "total": total,
        "real": reals,
        "fake": fakes,
        "fake_rate": fake_rate,
        "avg_confidence": avg_conf,
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
