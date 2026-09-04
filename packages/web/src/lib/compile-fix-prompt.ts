/** Canonical bare compile-fix chip prompt — not user-visible error text. */
export const COMPILE_FIX_USER_MESSAGE = "Find the error that stopping the compiler";

const COMPILE_FIX_AI_PROMPT_RE = /\bfind the error that stopping the compiler\b/i;

/** True for the bare compile-fix chip prompt — not a user-visible error or report text. */
export function isCompileFixAiPrompt(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return trimmed === COMPILE_FIX_USER_MESSAGE || COMPILE_FIX_AI_PROMPT_RE.test(trimmed);
}
