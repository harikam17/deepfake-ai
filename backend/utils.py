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

    # Feature 1: color std (real photos have rich tonal range, std ~0.15-0.30)
    std = float(arr.std())
    # Feature 2: edge energy via abs gradient magnitude
    gx = np.abs(np.diff(arr, axis=1)).mean()
    gy = np.abs(np.diff(arr, axis=0)).mean()
    edge_energy = float(gx + gy)
    # Feature 3: deterministic hash jitter for stability
    h = hashlib.md5(img.tobytes()).hexdigest()
    hash_factor = int(h[:8], 16) / 0xFFFFFFFF  # 0..1

    # Normalize features to 0..1 ranges typical of real photos
    f_std = min(std / 0.25, 1.0)          # ~1.0 for normal photos
    f_edge = min(edge_energy / 0.10, 1.0)  # ~1.0 for natural texture
    # Small jitter so different images vary, centered around 0
    jitter = (hash_factor - 0.5) * 0.15

    # Higher score = more REAL. Weighted toward photo-like features.
    score = 0.55 * f_std + 0.35 * f_edge + 0.10 * 0.5 + jitter
    score = max(0.0, min(1.0, score))

    if score >= 0.5:
        result = "REAL"
        confidence = round(90 + (score - 0.5) * 20, 2)
    else:
        result = "FAKE"
        confidence = round(90 + (0.5 - score) * 20, 2)
    confidence = max(90.0, min(confidence, 100.0))
    return result, confidence
