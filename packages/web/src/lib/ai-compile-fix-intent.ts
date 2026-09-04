/** Detect when the user wants compile errors fixed (typed, voice, or chip). */

import {
  classifyCompileDiagnosticsReviewFallback,
  detectCompileDiagnosticsIntent,
} from "@/lib/ai-compile-diagnostics-intent";
import {
  buildCompileFixUserMessage,
  type CompileFailureReportError,
} from "@/lib/compile-failure-report-message";
import { COMPILE_FIX_USER_MESSAGE, isCompileFixAiPrompt } from "@/lib/compile-fix-prompt";

export { COMPILE_FIX_USER_MESSAGE } from "@/lib/compile-fix-prompt";
export { COMPILE_FIX_MESSAGE_LEAD_IN } from "@/lib/compile-failure-report-message";

const COMPILE_FIX_ERROR_MESSAGE_RE = /^fix these compile errors:/i;

/** True for Fix-with-AI chat messages that include quoted compile errors. */
export function isCompileFixErrorBearingMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return COMPILE_FIX_ERROR_MESSAGE_RE.test(trimmed);
}

export { isCompileFixAiPrompt } from "@/lib/compile-fix-prompt";

/** Quick-action / voice action id that triggers compile-fix mode. */
export const COMPILE_FIX_ACTION = "explain-errors";

export interface CompileFixAiRequest {
  message: string;
  action: typeof COMPILE_FIX_ACTION;
}

export function buildCompileFixAiRequest(options?: {
  errors?: readonly CompileFailureReportError[];
  log?: string;
}): CompileFixAiRequest {
  const message =
    options?.errors && options.errors.length > 0
      ? buildCompileFixUserMessage({ errors: options.errors, log: options.log })
      : COMPILE_FIX_USER_MESSAGE;

  return {
    message,
    action: COMPILE_FIX_ACTION,
  };
}

/** Automatic follow-up compile-fix turn after a post-fix compile still fails. */
export function buildCompileFixAutoRetryRequest(options?: {
  errors?: readonly CompileFailureReportError[];
  log?: string;
}): CompileFixAiRequest & {
  autoCompileFixRetry: true;
} {
  return {
    ...buildCompileFixAiRequest(options),
    autoCompileFixRetry: true,
  };
}

/** Explicit fix-the-errors phrasing — not bare "compile" or status questions. */
const FIX_INTENT_PATTERNS: RegExp[] = [
  /\bfix\b.+\b(errors?|compile|compilation|latex)\b/i,
  /\b(errors?|compile|compilation|latex)\b.+\bfix\b/i,
  /\bnot compiling\b/i,
  /\bnot building\b/i,
  /\bcompile errors?\b/i,
  /\bcompilation errors?\b/i,
  /\bfix the errors?\b/i,
];

export function detectFixCompileIntent(text: string, action?: string): boolean {
  if (action === "explain-errors") return true;

  const trimmed = text.trim();
  if (!trimmed) return false;

  if (isCompileFixAiPrompt(trimmed) || isCompileFixErrorBearingMessage(trimmed)) {
    return true;
  }

  return FIX_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export { classifyCompileDiagnosticsReviewFallback, detectCompileDiagnosticsIntent };

export function isCompileAwareMessage(text: string, action?: string): boolean {
  return detectFixCompileIntent(text, action) || detectCompileDiagnosticsIntent(text, action);
}

/**
 * Resolve compile-fix vs diagnostics-review routing.
 * Review (log/warning/status) wins over fix unless explain-errors action is set.
 */
export function resolveCompileRouting(options: {
  message: string;
  action?: string;
  diagnosticsReview: boolean;
}): { compileFix: boolean; diagnosticsReview: boolean } {
  if (options.action === "explain-errors") {
    return { compileFix: true, diagnosticsReview: false };
  }

  if (options.diagnosticsReview) {
    return { compileFix: false, diagnosticsReview: true };
  }

  const compileFix = detectFixCompileIntent(options.message, options.action);
  return { compileFix, diagnosticsReview: false };
}
