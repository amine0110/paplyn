const DANGEROUS_SCHEME_RE = /(?:javascript|data|vbscript):/gi;
const HTML_TAG_RE = /<[^>]*>/g;

/** Neutralize javascript:, data:, and vbscript: URL schemes to plain text. */
export function neutralizeDangerousSchemes(text: string): string {
  return text.replace(DANGEROUS_SCHEME_RE, (match) => match.replace(":", ": "));
}

/** Treat input as plain text: strip HTML tags and neutralize dangerous schemes. */
export function sanitizePlainText(text: string): string {
  return neutralizeDangerousSchemes(text.replace(HTML_TAG_RE, ""));
}
