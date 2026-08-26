import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const USER_REPORT_CSRF_COOKIE = "paplyn_user_report_csrf";
export const USER_REPORT_CSRF_HEADER = "x-user-report-csrf";

export function createUserReportCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyUserReportCsrf(cookieToken: string | undefined, providedToken: string | undefined): boolean {
  if (!cookieToken || !providedToken) return false;
  if (cookieToken.length !== providedToken.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(providedToken));
  } catch {
    return false;
  }
}

/** Hash IP for rate-limit keys without storing raw IPs in long-lived maps (v1 in-memory). */
export function hashRateLimitKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
