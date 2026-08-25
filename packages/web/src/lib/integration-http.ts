import { PRODUCT_NAME, PUBLIC_SITE_URL } from "@/lib/product";

/** Contact-style User-Agent for Crossref, OpenAlex, arXiv, and GitHub API requests. */
export const INTEGRATION_USER_AGENT = `${PRODUCT_NAME} (${PUBLIC_SITE_URL}; mailto:support@${PUBLIC_SITE_URL.replace(/^https?:\/\//, "")})`;

export function buildIntegrationHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    Accept: "application/json",
    "User-Agent": INTEGRATION_USER_AGENT,
    ...extra,
  };
}
