/** Shared settings for lightweight LLM intent/diagnostics classifiers. */

export const CLASSIFY_TIMEOUT_MS = 8_000;

/** Muse Spark models always reason and are unsuitable for tiny JSON router calls. */
export function isMuseSparkModel(modelId: string): boolean {
  const normalized = modelId.trim().toLowerCase();
  return normalized.includes("muse-spark") || normalized.includes("spark-1.");
}

export function shouldSkipLlmClassify(modelId: string | undefined): boolean {
  if (!modelId?.trim()) return false;
  return isMuseSparkModel(modelId);
}

export function classifyAbortSignal(): AbortSignal {
  return AbortSignal.timeout(CLASSIFY_TIMEOUT_MS);
}
