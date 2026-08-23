import { APICallError } from "ai";

const UNKNOWN_TOOL_PATTERNS = [
  "was not in request.tools",
  "attempted to call tool",
  "tool call validation failed",
] as const;

export function isUnknownToolCallError(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false;
  const msg = error.message.toLowerCase();
  return UNKNOWN_TOOL_PATTERNS.some((pattern) => msg.includes(pattern));
}

export function formatAiRequestError(error: unknown): string {
  if (isUnknownToolCallError(error)) {
    return "The assistant tried to use an unavailable tool. Please try again — edits should apply on retry.";
  }
  if (APICallError.isInstance(error) && error.message) {
    return error.message;
  }
  return "AI request failed. Please try again.";
}

export const UNKNOWN_TOOL_RETRY_HINT = `Important: only call tools that are explicitly listed for this request (get_file, fix_compile_errors, apply_edit, insert_at_cursor, replace_selection). Do not call any other tool names.`;
