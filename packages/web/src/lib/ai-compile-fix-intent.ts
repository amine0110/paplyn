/** Detect when the user wants compile errors fixed (typed, voice, or chip). */

/** Canonical user message for compile-fix requests (sidebar chip, Fix with AI, etc.). */
export const COMPILE_FIX_USER_MESSAGE = "Find the error that stopping the compiler";

/** Quick-action / voice action id that triggers compile-fix mode. */
export const COMPILE_FIX_ACTION = "explain-errors";

export interface CompileFixAiRequest {
  message: string;
  action: typeof COMPILE_FIX_ACTION;
}

export function buildCompileFixAiRequest(): CompileFixAiRequest {
  return {
    message: COMPILE_FIX_USER_MESSAGE,
    action: COMPILE_FIX_ACTION,
  };
}

const FIX_INTENT_PATTERNS: RegExp[] = [
  /\bfix\b/i,
  /\bcompile\b/i,
  /\bcompiling\b/i,
  /\bcompilation\b/i,
  /\bnot compiling\b/i,
  /\bnot building\b/i,
  /\bcompile errors?\b/i,
  /\bcompilation errors?\b/i,
  /\blatex errors?\b/i,
  /\berrors?\b/i,
];

export function detectFixCompileIntent(text: string, action?: string): boolean {
  if (action === "explain-errors") return true;

  const trimmed = text.trim();
  if (!trimmed) return false;

  return FIX_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}
