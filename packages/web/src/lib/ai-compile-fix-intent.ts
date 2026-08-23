/** Detect when the user wants compile errors fixed (typed, voice, or chip). */

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
