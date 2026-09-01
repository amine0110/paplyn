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

/** Automatic follow-up compile-fix turn after a post-fix compile still fails. */
export function buildCompileFixAutoRetryRequest(): CompileFixAiRequest & {
  autoCompileFixRetry: true;
} {
  return {
    ...buildCompileFixAiRequest(),
    autoCompileFixRetry: true,
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

/** Review warnings/log/overfull — compile-aware chat, not the heavy compile-fix path. */
const COMPILE_DIAGNOSTICS_PATTERNS: RegExp[] = [
  /\bwarnings?\b/i,
  /\boverfull\b/i,
  /\bunderfull\b/i,
  /\bundefined references?\b/i,
  /\bcheck (?:the )?compile\b/i,
  /\bseveral warnings?\b/i,
  /\bcompile log\b/i,
  /\bcompilation log\b/i,
  /\bpdflatex log\b/i,
  /\bxelatex log\b/i,
  /\blualatex log\b/i,
  /\b(?:see|read|show|review) (?:the )?log\b/i,
];

export function detectFixCompileIntent(text: string, action?: string): boolean {
  if (action === "explain-errors") return true;

  const trimmed = text.trim();
  if (!trimmed) return false;

  return FIX_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function detectCompileDiagnosticsIntent(text: string, action?: string): boolean {
  if (action === "explain-errors") return false;

  const trimmed = text.trim();
  if (!trimmed) return false;

  return COMPILE_DIAGNOSTICS_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isCompileAwareMessage(text: string, action?: string): boolean {
  return detectFixCompileIntent(text, action) || detectCompileDiagnosticsIntent(text, action);
}
