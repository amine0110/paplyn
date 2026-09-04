import { isCompileFixAiPrompt } from "@/lib/compile-fix-prompt";
import { REPORT_WHAT_HAPPENED_MAX } from "@/lib/user-reports-validation";

export type CompileFailureReportError = {
  line?: number;
  file?: string;
  message: string;
  severity?: "error" | "warning";
};

const GENERIC_COMPILE_FAILURE_MESSAGES = new Set([
  "Compilation failed",
  "Compilation failed — see log for details",
  "Compilation failed — see errors below the editor",
  "Failed to compile",
]);

const MAX_REPORT_ERRORS = 5;
const MAX_LOG_EXCERPT_LINES = 24;

function isGenericCompileFailureMessage(message: string): boolean {
  return GENERIC_COMPILE_FAILURE_MESSAGES.has(message.trim());
}

function formatCompileErrorForReport(error: CompileFailureReportError): string {
  if (error.file && error.line != null) {
    return `${error.file}:${error.line}: ${error.message}`;
  }
  if (error.line != null) {
    return `L${error.line}: ${error.message}`;
  }
  return error.message;
}

function tailCompileLogExcerpt(log: string, maxLines = MAX_LOG_EXCERPT_LINES): string {
  const lines = log
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  if (lines.length === 0) return "";
  return lines.slice(-maxLines).join("\n");
}

function trimReportMessage(message: string): string {
  return message.trim().slice(0, REPORT_WHAT_HAPPENED_MAX);
}

/** Build the compile failure text shown in the UI and sent in /report payloads. */
export function buildCompileFailureReportMessage(options: {
  errors: readonly CompileFailureReportError[];
  log?: string;
}): string {
  const errorList = options.errors.filter((error) => error.severity === "error");
  const formattedErrors = errorList
    .slice(0, MAX_REPORT_ERRORS)
    .map((error) => formatCompileErrorForReport(error))
    .filter((message) => message.trim() && !isCompileFixAiPrompt(message));

  const hasSpecificErrors = formattedErrors.some((message) => !isGenericCompileFailureMessage(message));
  const logExcerpt = options.log?.trim() ? tailCompileLogExcerpt(options.log) : "";

  if (hasSpecificErrors) {
    const message = formattedErrors.join("\n");
    if (logExcerpt && formattedErrors.every(isGenericCompileFailureMessage)) {
      return trimReportMessage(`${message}\n\nCompile log excerpt:\n${logExcerpt}`);
    }
    return trimReportMessage(message);
  }

  if (logExcerpt) {
    return trimReportMessage(`Compile log excerpt:\n${logExcerpt}`);
  }

  if (formattedErrors.length > 0) {
    return trimReportMessage(formattedErrors.join("\n"));
  }

  return trimReportMessage("Compilation failed");
}

/** Lead-in for Fix-with-AI chat messages that quote on-screen compile errors. */
export const COMPILE_FIX_MESSAGE_LEAD_IN = "Fix these compile errors:";

/** Build the user-visible Fix-with-AI chat message from on-screen compile errors. */
export function buildCompileFixUserMessage(options: {
  errors: readonly CompileFailureReportError[];
  log?: string;
}): string {
  const errorText = buildCompileFailureReportMessage(options).trim();
  if (!errorText) {
    return COMPILE_FIX_MESSAGE_LEAD_IN;
  }

  const bulletLines = errorText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join("\n");

  return `${COMPILE_FIX_MESSAGE_LEAD_IN}\n${bulletLines}`;
}

/** Never send the compile-fix AI chip prompt as a user report. */
export function resolveReportWhatHappenedMessage(
  message: string,
  fallback?: string | null,
): string | null {
  const trimmed = message.trim();
  if (trimmed && !isCompileFixAiPrompt(trimmed)) {
    return trimmed;
  }

  const fallbackTrimmed = fallback?.trim() ?? "";
  if (fallbackTrimmed && !isCompileFixAiPrompt(fallbackTrimmed)) {
    return fallbackTrimmed;
  }

  return null;
}
