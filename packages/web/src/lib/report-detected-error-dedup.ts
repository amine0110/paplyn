export const DETECTED_ERROR_DEDUP_TTL_MS = 30 * 60 * 1000;
export const DETECTED_ERROR_DEDUP_STORAGE_PREFIX = "paplyn:error-report:";

export type DetectedErrorKind = "compile" | "cite" | "unexpected" | "ai";

export function titleForDetectedErrorKind(kind: DetectedErrorKind): string {
  switch (kind) {
    case "compile":
      return "Compile failed";
    case "cite":
      return "Cite failed";
    case "ai":
      return "AI request failed";
    case "unexpected":
      return "Unexpected error";
  }
}

/** Small deterministic hash for client-side dedup keys (no node:crypto). */
export function hashDetectedErrorDedupKey(kind: string, message: string, page: string): string {
  const input = `${kind}\0${message}\0${page}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function shouldSkipDetectedErrorReport(
  storageKey: string,
  readValue: (key: string) => string | null,
  now = Date.now(),
): boolean {
  const raw = readValue(`${DETECTED_ERROR_DEDUP_STORAGE_PREFIX}${storageKey}`);
  if (!raw) return false;
  const reportedAt = Number(raw);
  if (!Number.isFinite(reportedAt)) return false;
  return now - reportedAt < DETECTED_ERROR_DEDUP_TTL_MS;
}

export function markDetectedErrorReported(
  storageKey: string,
  writeValue: (key: string, value: string) => void,
  now = Date.now(),
): void {
  writeValue(`${DETECTED_ERROR_DEDUP_STORAGE_PREFIX}${storageKey}`, String(now));
}
