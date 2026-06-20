import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { analyzePixels, base64ToNormalizedPixels } from "./analysis";

export interface ScanEntry {
  id: string;
  result: "REAL" | "FAKE";
  confidence: number;
  filename: string;
  created_at: string;
}

export interface StatsResult {
  total: number;
  real: number;
  fake: number;
  fake_rate: number;
  avg_confidence: number;
}

export const analyzeImage = createServerFn({ method: "POST" })
  .inputValidator((input: { imageData: string; filename: string }) => input)
  .handler(async ({ data }) => {
    const normalized = base64ToNormalizedPixels(data.imageData);
    const { result, confidence } = analyzePixels(normalized);

    // Anonymize filename: store only the extension to avoid exposing
    // user-identifying information through the public scan history.
    const ext = (data.filename.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    const safeName = ext ? `image.${ext}` : "image";

    const { error } = await supabaseAdmin.from("scan_history").insert({
      result,
      confidence,
      filename: safeName,
    });


    if (error) {
      throw new Error(`Failed to save scan: ${error.message}`);
    }

    return { result, confidence, timestamp: new Date().toISOString() };
  });

export const getHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("scan_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to fetch history: ${error.message}`);
  }

  return (data ?? []) as ScanEntry[];
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin.from("scan_history").select("result, confidence");

  if (error) {
    throw new Error(`Failed to fetch stats: ${error.message}`);
  }

  const items = (data ?? []) as { result: "REAL" | "FAKE"; confidence: number }[];
  const total = items.length;
  const fake = items.filter((i) => i.result === "FAKE").length;
  const real = total - fake;
  const fakeRate = total ? Math.round((fake / total) * 100 * 10) / 10 : 1;
  const avgConf = total
    ? Math.round((items.reduce((s, i) => s + (i.confidence || 0), 0) / total) * 10) / 10
    : 1;

  return {
    total,
    real,
    fake,
    fake_rate: fakeRate,
    avg_confidence: avgConf,
  } as StatsResult;
});
