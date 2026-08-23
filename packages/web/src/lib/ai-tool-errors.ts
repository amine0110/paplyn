import { APICallError } from "ai";

export const PROMPT_TOO_LARGE_MESSAGE =
  "The project context is too large for the AI service. Try asking about a specific file or selection.";

export const AI_RATE_LIMIT_MESSAGE =
  "AI service rate limit reached. Please wait a moment and try again.";

/** Compile-fix prompts at or below this size are treated as slim (not context bloat). */
export const COMPILE_FIX_SLIM_PROMPT_MAX_CHARS = 12_000;

const TPM_OR_RATE_LIMIT_PATTERNS = [
  "tpm",
  "tokens per minute",
  "rate limit",
  "rate_limit",
  "requests per minute",
  "rpm",
  "too many requests",
] as const;

const PROMPT_TOO_LARGE_PATTERNS = [
  "too large",
  "too long",
  "maximum context",
  "context length",
  "context window",
  "prompt is too",
  "request too large",
  "payload too large",
  "exceeds the maximum",
] as const;

const UNKNOWN_TOOL_PATTERNS = [
  "was not in request.tools",
  "attempted to call tool",
  "tool call validation failed",
] as const;

const TOOL_CHOICE_NONE_PATTERNS = ["tool choice is none"] as const;

export const TOOL_CHOICE_NONE_MESSAGE =
  "The assistant hit a tool-handling glitch. Please try again — your edits should apply on retry.";

function messageIncludesAny(message: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => message.includes(pattern));
}

export function isTpmOrRateLimitMessage(message: string): boolean {
  return messageIncludesAny(message.toLowerCase(), TPM_OR_RATE_LIMIT_PATTERNS);
}

export function isPromptTooLargeMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  if (isTpmOrRateLimitMessage(normalized)) return false;
  return messageIncludesAny(normalized, PROMPT_TOO_LARGE_PATTERNS);
}

export function isAiPromptTooLargeError(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false;
  if (error.statusCode === 413) return true;
  if (error.statusCode === 429) {
    return isPromptTooLargeMessage(error.message);
  }
  return false;
}

export function isAiRateLimitError(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false;
  return error.statusCode === 429 && !isAiPromptTooLargeError(error);
}

export function isSlimCompileFixPrompt(
  systemPromptChars: number,
  messagesChars: number
): boolean {
  return systemPromptChars + messagesChars <= COMPILE_FIX_SLIM_PROMPT_MAX_CHARS;
}

/** Slim compile-fix 429s are treated as rate limits (TPM), not context bloat. */
export function shouldTreatCompileFix429AsRateLimit(
  error: unknown,
  systemPromptChars: number,
  messagesChars: number
): boolean {
  if (!APICallError.isInstance(error) || error.statusCode !== 429) return false;
  if (isAiRateLimitError(error)) return true;
  return isSlimCompileFixPrompt(systemPromptChars, messagesChars);
}

export function redactAiErrorMessage(message: string): string {
  return message
    .replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, "sk-[REDACTED]")
    .replace(/\bgsk_[a-zA-Z0-9_-]{8,}\b/g, "gsk_[REDACTED]")
    .slice(0, 500);
}

export function getRetryAfterSeconds(error: unknown): number | undefined {
  if (!APICallError.isInstance(error)) return undefined;
  const headers = error.responseHeaders ?? {};
  const raw =
    headers["retry-after"] ??
    headers["Retry-After"] ??
    headers["x-ratelimit-reset-requests"];
  if (raw == null) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const seconds = Number.parseInt(String(value), 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

export interface AiApiErrorLogContext {
  compileFix?: boolean;
  mode?: string;
  systemPromptChars?: number;
  messagesChars?: number;
  errorCount?: number;
}

export function logAiApiError(context: AiApiErrorLogContext, error: unknown): void {
  if (!APICallError.isInstance(error)) {
    console.error("[ai api error]", { ...context, error: String(error) });
    return;
  }

  console.error("[ai api error]", {
    ...context,
    statusCode: error.statusCode,
    message: redactAiErrorMessage(error.message),
    retryAfter: getRetryAfterSeconds(error),
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isUnknownToolCallError(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return UNKNOWN_TOOL_PATTERNS.some((pattern) => msg.includes(pattern));
}

export function isToolChoiceNoneViolationError(error: unknown): boolean {
  const msg = errorMessage(error).toLowerCase();
  return TOOL_CHOICE_NONE_PATTERNS.some((pattern) => msg.includes(pattern));
}

export function formatAiRequestError(error: unknown): string {
  if (isUnknownToolCallError(error)) {
    return "The assistant tried to use an unavailable tool. Please try again — edits should apply on retry.";
  }
  if (isToolChoiceNoneViolationError(error)) {
    return TOOL_CHOICE_NONE_MESSAGE;
  }
  if (APICallError.isInstance(error) && error.message) {
    return error.message;
  }
  return "AI request failed. Please try again.";
}

export const UNKNOWN_TOOL_RETRY_HINT = `Important: only call workspace tools that are explicitly listed for this request (list_files, get_file, fix_compile_errors, apply_edit, replace_lines, insert_at_cursor, replace_selection, and any plugin tools shown above). Do not call any other tool names.`;

export const TOOL_CHOICE_NONE_RETRY_HINT = `Important: use get_file and fix_compile_errors, apply_edit, or replace_lines to fix the compile errors, then reply with a short summary of what you changed. Prefer replace_lines when errors cite a line number. After edits are applied, do not call tools again in the same turn.`;
