"use client";

import { USER_REPORT_CSRF_HEADER } from "@/lib/user-reports-csrf-constants";
import {
  hashDetectedErrorDedupKey,
  markDetectedErrorReported,
  shouldSkipDetectedErrorReport,
  titleForDetectedErrorKind,
  type DetectedErrorKind,
} from "@/lib/report-detected-error-dedup";
import { sanitizePlainText } from "@/lib/user-reports-sanitize";
import { REPORT_WHAT_HAPPENED_MAX } from "@/lib/user-reports-validation";

export type { DetectedErrorKind } from "@/lib/report-detected-error-dedup";

export type ReportDetectedErrorInput = {
  kind: DetectedErrorKind;
  message: string;
  page?: string;
  steps?: string;
};

export type ReportDetectedErrorResult = {
  sent: boolean;
  skipped: boolean;
};

let csrfFetchPromise: Promise<string | null> | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  if (csrfFetchPromise) return csrfFetchPromise;

  csrfFetchPromise = (async () => {
    try {
      const response = await fetch("/api/user-reports/csrf", { credentials: "same-origin" });
      if (response.status === 503) return null;
      if (!response.ok) return null;
      const data = (await response.json()) as { csrfToken?: string };
      return typeof data.csrfToken === "string" ? data.csrfToken : null;
    } catch {
      return null;
    } finally {
      csrfFetchPromise = null;
    }
  })();

  return csrfFetchPromise;
}

function resolvePage(page?: string): string {
  if (page?.trim()) return page.trim();
  if (typeof window !== "undefined") {
    return `${window.location.pathname}${window.location.search}`;
  }
  return "/";
}

function normalizeMessage(message: string): string {
  return sanitizePlainText(message.trim()).slice(0, REPORT_WHAT_HAPPENED_MAX);
}

export async function reportDetectedError(
  input: ReportDetectedErrorInput,
): Promise<ReportDetectedErrorResult> {
  const message = normalizeMessage(input.message);
  if (!message) {
    return { sent: false, skipped: true };
  }

  const page = resolvePage(input.page);
  const dedupKey = hashDetectedErrorDedupKey(input.kind, message, page);

  if (typeof sessionStorage !== "undefined") {
    if (
      shouldSkipDetectedErrorReport(dedupKey, (key) => sessionStorage.getItem(key))
    ) {
      return { sent: false, skipped: true };
    }
  }

  const token = await fetchCsrfToken();
  if (!token) {
    return { sent: false, skipped: false };
  }

  try {
    const response = await fetch("/api/user-reports", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        [USER_REPORT_CSRF_HEADER]: token,
      },
      body: JSON.stringify({
        title: titleForDetectedErrorKind(input.kind),
        whatHappened: message,
        steps: input.steps?.trim() ? sanitizePlainText(input.steps.trim()) : input.kind,
        page,
        source: "error",
        honeypot: "",
        csrfToken: token,
        autoDetected: true,
      }),
    });

    if (response.status === 503 || response.status === 429) {
      return { sent: false, skipped: response.status === 429 };
    }

    if (!response.ok) {
      return { sent: false, skipped: false };
    }

    if (typeof sessionStorage !== "undefined") {
      markDetectedErrorReported(dedupKey, (key, value) => sessionStorage.setItem(key, value));
    }

    return { sent: true, skipped: false };
  } catch {
    return { sent: false, skipped: false };
  }
}
