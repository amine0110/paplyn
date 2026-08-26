/** Public Notion database id for Paplyn user reports (PAP-30 inbox). */
export const USER_REPORTS_DATABASE_ID = "b700d0bff26d432b93fb506d64c8f099";

/** Internal PAP tracker — never insert user reports here. */
export const PAP_INTERNAL_TRACKER_COLLECTION = "b41c2d1b-4c9a-4468-a159-eefdebe9890e";

export function getNotionUserReportsToken(): string | null {
  const token =
    process.env.NOTION_USER_REPORTS_TOKEN?.trim() || process.env.NOTION_TOKEN?.trim();
  return token || null;
}

export function getNotionUserReportsDatabaseId(): string {
  const configured = process.env.NOTION_USER_REPORTS_DATABASE_ID?.trim();
  return configured || USER_REPORTS_DATABASE_ID;
}

export function isUserReportsEnabled(): boolean {
  return getNotionUserReportsToken() !== null;
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
