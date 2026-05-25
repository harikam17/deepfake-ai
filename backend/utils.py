"""Mock deepfake analysis using simple image statistics.

Produces deterministic, plausible-looking results based on image features
so the same image yields the same verdict each time.
"""
import hashlib
import numpy as np
from PIL import Image


def analyze_image(img: Image.Image):
    """Return (result, confidence) where result is 'REAL' or 'FAKE'."""
    img_small = img.resize((128, 128))
    arr = np.asarray(img_small, dtype=np.float32) / 255.0

    # Feature 1: color channel variance (real photos tend to have richer variance)
    variance = float(arr.var())
    # Feature 2: edge-ish energy via gradient magnitude
    gx = np.diff(arr, axis=1).mean()
    gy = np.diff(arr, axis=0).mean()
    edge_energy = float(abs(gx) + abs(gy))
    # Feature 3: deterministic hash factor for stability
    h = hashlib.md5(img.tobytes()).hexdigest()
    hash_factor = int(h[:8], 16) / 0xFFFFFFFF  # 0..1

    # Score in 0..1; higher = more likely REAL
    score = 0.55 * min(variance * 6, 1.0) + 0.25 * min(edge_energy * 50, 1.0) + 0.20 * hash_factor
    score = max(0.0, min(1.0, score))

    if score >= 0.5:
        result = "REAL"
        confidence = round(50 + (score - 0.5) * 99, 2)  # 50..99.5
    else:
        result = "FAKE"
        confidence = round(50 + (0.5 - score) * 99, 2)

    confidence = max(55.0, min(confidence, 99.5))
    return result, confidence
