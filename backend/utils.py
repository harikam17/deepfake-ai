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

    # Feature 1: color std (real photos: ~0.15-0.30)
    std = float(arr.std())
    # Feature 2: edge energy via abs gradient magnitude
    gx = np.abs(np.diff(arr, axis=1)).mean()
    gy = np.abs(np.diff(arr, axis=0)).mean()
    edge_energy = float(gx + gy)
    # Feature 3: high-frequency noise ratio (deepfakes often over-smooth)
    noise = float(np.abs(arr - arr.mean(axis=(0, 1))).std())
    # Deterministic hash so same image -> same verdict
    h = hashlib.md5(img.tobytes()).hexdigest()
    hash_factor = int(h[:8], 16) / 0xFFFFFFFF  # 0..1

    # Normalize each feature to 0..1 around typical photo values
    f_std = min(std / 0.22, 1.2) - 0.5      # centered, can be +/-
    f_edge = min(edge_energy / 0.08, 1.2) - 0.5
    f_noise = min(noise / 0.18, 1.2) - 0.5
    feature_score = (f_std + f_edge + f_noise) / 3  # roughly -0.5..0.7

    # Combine features with hash so verdicts are balanced across images
    score = 0.5 + 0.4 * feature_score + 0.5 * (hash_factor - 0.5)
    score = max(0.0, min(1.0, score))

    if score >= 0.5:
        result = "REAL"
        confidence = round(90 + (score - 0.5) * 20, 2)
    else:
        result = "FAKE"
        confidence = round(90 + (0.5 - score) * 20, 2)
    confidence = max(90.0, min(confidence, 100.0))
    return result, confidence
