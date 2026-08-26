import { isInternalAppPath } from "@/lib/internal-path";
import {
  REPORT_STEPS_MAX,
  REPORT_TITLE_MAX,
  REPORT_WHAT_HAPPENED_MAX,
} from "@/lib/user-reports-validation";

export type ReportIssuePrefill = {
  title?: string;
  whatHappened?: string;
  steps?: string;
};

export function buildReportIssueHref(
  page?: string,
  source: "error" | "report" = "error",
  prefill?: ReportIssuePrefill,
): string {
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
  if (prefill?.title?.trim()) {
    params.set("title", prefill.title.trim().slice(0, REPORT_TITLE_MAX));
  }
  if (prefill?.whatHappened?.trim()) {
    params.set("what", prefill.whatHappened.trim().slice(0, REPORT_WHAT_HAPPENED_MAX));
  }
  if (prefill?.steps?.trim()) {
    params.set("steps", prefill.steps.trim().slice(0, REPORT_STEPS_MAX));
  }
  const query = params.toString();
  return query ? `/report?${query}` : "/report";
}
