/**
 * In-memory rate limits for user report submissions (v1).
 * Resets on process restart; acceptable for v1 per PAP-30.
 */
type RateLimitBucket = {
  timestamps: number[];
};

export type RateLimitStore = Map<string, RateLimitBucket>;

export const IP_REPORT_LIMIT = 3;
export const IP_REPORT_WINDOW_MS = 10 * 60 * 1000;

export const USER_REPORT_LIMIT = 5;
export const USER_REPORT_WINDOW_MS = 60 * 60 * 1000;

const ipStore: RateLimitStore = new Map();
const userStore: RateLimitStore = new Map();

function pruneAndCount(bucket: RateLimitBucket, now: number, windowMs: number): number {
  bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < windowMs);
  return bucket.timestamps.length;
}

export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds?: number } {
  const bucket = store.get(key) ?? { timestamps: [] };
  const count = pruneAndCount(bucket, now, windowMs);

  if (count >= limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterSeconds =
      oldest !== undefined ? Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) : undefined;
    store.set(key, bucket);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  store.set(key, bucket);
  return { allowed: true };
}

export function evaluateReportRateLimits(input: {
  ipKey: string;
  userId?: string | null;
  now?: number;
  ipStore?: RateLimitStore;
  userStore?: RateLimitStore;
}): { allowed: boolean; reason?: "ip" | "user"; retryAfterSeconds?: number } {
  const now = input.now ?? Date.now();
  const ipResult = checkRateLimit(
    input.ipStore ?? ipStore,
    input.ipKey,
    IP_REPORT_LIMIT,
    IP_REPORT_WINDOW_MS,
    now,
  );
  if (!ipResult.allowed) {
    return { allowed: false, reason: "ip", retryAfterSeconds: ipResult.retryAfterSeconds };
  }

  if (input.userId) {
    const userResult = checkRateLimit(
      input.userStore ?? userStore,
      input.userId,
      USER_REPORT_LIMIT,
      USER_REPORT_WINDOW_MS,
      now,
    );
    if (!userResult.allowed) {
      return { allowed: false, reason: "user", retryAfterSeconds: userResult.retryAfterSeconds };
    }
  }

  return { allowed: true };
}

/** Test-only: clear in-memory rate limit stores. */
export function clearReportRateLimitStores(): void {
  ipStore.clear();
  userStore.clear();
}
