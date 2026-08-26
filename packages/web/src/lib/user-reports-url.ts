import { isInternalAppPath } from "@/lib/internal-path";

export function buildReportIssueHref(page?: string, source: "error" | "report" = "error"): string {
  const params = new URLSearchParams();
  if (source === "error") {
    params.set("source", "error");
  }
  if (page?.trim()) {
    const trimmed = page.trim();
    if (isInternalAppPath(trimmed)) {
      params.set("page", trimmed.slice(0, 500));
    }
  }
  const query = params.toString();
  return query ? `/report?${query}` : "/report";
}
