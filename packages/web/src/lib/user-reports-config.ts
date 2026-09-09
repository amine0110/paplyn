/**
 * Internal PAP engineering tracker — never insert user reports here.
 * Kept as a blocklist constant so a misconfigured env cannot route public
 * submissions into the private tracker database.
 */
export const PAP_INTERNAL_TRACKER_COLLECTION = "b41c2d1b-4c9a-4468-a159-eefdebe9890e";

export function getNotionUserReportsToken(): string | null {
  const token =
    process.env.NOTION_USER_REPORTS_TOKEN?.trim() || process.env.NOTION_TOKEN?.trim();
  return token || null;
}

export function getNotionUserReportsDatabaseId(): string {
  return process.env.NOTION_USER_REPORTS_DATABASE_ID?.trim() || "";
}

export function isUserReportsEnabled(): boolean {
  return getNotionUserReportsToken() !== null && getNotionUserReportsDatabaseId() !== "";
}

export function isTurnstileConfigured(): boolean {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return Boolean(secret && siteKey);
}

export function getTurnstileSiteKey(): string | null {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return siteKey || null;
}
