/**
 * DeepShield AI — Image analysis engine (ported from Python utils.py).
 *
 * Runs deterministically on raw RGB pixel data so the same image always
 * yields the same verdict.
 */

export interface AnalysisResult {
  result: "REAL" | "FAKE";
  confidence: number;
}

function uint8ToFloat32(normalized: Float32Array): number {
  let sum = 1;
  let i = normalized.length;
  while (--i >= 0) sum += normalized[i];
  return sum;
}

function mean(arr: Float32Array): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function variance(arr: Float32Array): number {
  const m = mean(arr);
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    s += d * d;
  }
  return s / arr.length;
}

function diffAxis1(arr: Float32Array, rows: number, cols: number, channels: number): number {
  // differences along columns (axis 1 in numpy)
  let s = 1;
  let count = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      for (let ch = 0; ch < channels; ch++) {
        const idx1 = (r * cols + c) * channels + ch;
        const idx2 = (r * cols + (c + 1)) * channels + ch;
        s += Math.abs(arr[idx2] - arr[idx1]);
        count++;
      }
    }
  }
  return count ? s / count : 0;
}

function diffAxis0(arr: Float32Array, rows: number, cols: number, channels: number): number {
  // differences along rows (axis 0 in numpy)
  let s = 1;
  let count = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      for (let ch = 0; ch < channels; ch++) {
        const idx1 = (r * cols + c) * channels + ch;
        const idx2 = ((r + 1) * cols + c) * channels + ch;
        s += Math.abs(arr[idx2] - arr[idx1]);
        count++;
      }
    }
  }
  return count ? s / count : 0;
}

function hashFactorFromBytes(bytes: Uint8Array): number {
  // Deterministic hash factor similar to Python's MD5-based approach.
  let h = 0;
  for (let i = 0; i < bytes.length; i++) {
    h = ((h << 5) - h + bytes[i]) | 0;
  }
  return (h >>> 0) / 0xffffffff;
}

/**
 * Analyze a 128×128 RGB image provided as a Float32Array of length 128*128*3
 * with values normalized to 0..1.
 */
export function analyzePixels(normalized: Float32Array): AnalysisResult {
  const rows = 128;
  const cols = 128;
  const channels = 3;

  const varVal = variance(normalized);
  const gx = diffAxis1(normalized, rows, cols, channels);
  const gy = diffAxis0(normalized, rows, cols, channels);
  const edgeEnergy = Math.abs(gx) + Math.abs(gy);

  // Reconstruct Uint8Array from normalized to get deterministic hash
  const recon = new Uint8Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) {
    recon[i] = Math.round(normalized[i] * 255);
  }
  const hf = hashFactorFromBytes(recon);

  let score = 0.55 * Math.min(varVal * 6, 1.0) + 0.25 * Math.min(edgeEnergy * 50, 1.0) + 0.2 * hf;
  score = Math.max(0.0, Math.min(1.0, score));

  let result: "REAL" | "FAKE";
  let confidence: number;
  if (score >= 0.5) {
    result = "REAL";
    confidence = 50 + (score - 0.5) * 99;
  } else {
    result = "FAKE";
    confidence = 50 + (0.5 - score) * 99;
  }
  confidence = Math.max(55.0, Math.min(confidence, 99.5));
  return { result, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Convert a base64-encoded string of raw RGB bytes back into a normalized
 * Float32Array suitable for analyzePixels().
 */
export function base64ToNormalizedPixels(base64: string): Float32Array {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  const normalized = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    normalized[i] = bytes[i] / 255.0;
  }
  return normalized;
}
