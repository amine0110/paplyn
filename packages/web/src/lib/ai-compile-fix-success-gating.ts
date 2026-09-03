/** Gate premature "fixed/resolved" claims on compile-fix assistant replies. */

const COMPILE_FIX_SUCCESS_CLAIM_PATTERNS: RegExp[] = [
  /\b(?:the\s+)?issue\s+is\s+fixed\b/i,
  /\b(?:i(?:'ve| have))\s+fixed\b/i,
  /\b(?:errors?|problem|issue|references?|citations?)\s+(?:is|are)\s+(?:now\s+)?(?:fixed|resolved)\b/i,
  /\b(?:should|ought to)\s+compile\s+(?:successfully|now|correctly)\b/i,
  /\bcompile(?:s|ation)?\s+(?:should\s+)?(?:work|succeed)(?:\s+now)?\b/i,
  /\b(?:that|this)\s+(?:should\s+)?(?:fix(?:es|ed)?|resolve[sd]?)\s+(?:the\s+)?(?:error|issue|problem)\b/i,
  /\ball\s+(?:compile\s+)?errors?\s+(?:are\s+)?(?:fixed|resolved|cleared)\b/i,
  /\bno\s+more\s+(?:compile\s+)?errors?\b/i,
];

export function claimsCompileFixSuccess(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return COMPILE_FIX_SUCCESS_CLAIM_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export interface SanitizeCompileFixSuccessOptions {
  compileFixRequest: boolean;
  appliedEditCount: number;
  compileErrorCount: number;
  /** True when the client confirmed a post-fix compile (auto-retry after recompile). */
  postEditCompileKnown?: boolean;
}

function buildHonestCompileFixMessage(options: SanitizeCompileFixSuccessOptions): string {
  const { appliedEditCount, compileErrorCount, postEditCompileKnown } = options;

  if (appliedEditCount <= 0) {
    return "I could not apply an edit for these compile errors.";
  }

  if (postEditCompileKnown && compileErrorCount > 0) {
    return (
      "I applied a change, but the last compile still reported errors. " +
      "Review the compile log for what remains, or describe the next error to fix."
    );
  }

  if (compileErrorCount > 0) {
    return (
      "I applied the change. Recompile to check whether the compile errors are resolved."
    );
  }

  return "I applied the change. Recompile to verify the project builds cleanly.";
}

/**
 * Replace premature success claims when compile-fix edits have not been verified by a clean compile.
 */
export function sanitizeCompileFixSuccessClaims(
  content: string,
  options: SanitizeCompileFixSuccessOptions
): string {
  if (!options.compileFixRequest) return content;
  if (!claimsCompileFixSuccess(content)) return content;

  const canClaimSuccess =
    options.appliedEditCount > 0 &&
    options.postEditCompileKnown === true &&
    options.compileErrorCount <= 0;

  if (canClaimSuccess) return content;

  const honest = buildHonestCompileFixMessage(options);
  const stripped = content
    .split("\n")
    .filter((line) => !claimsCompileFixSuccess(line))
    .join("\n")
    .trim();

  if (!stripped) return honest;
  if (stripped === content.trim()) return honest;
  return `${stripped}\n\n${honest}`;
}
