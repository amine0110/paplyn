export interface CompileErrorLike {
  severity: "error" | "warning";
}

export function countCompileErrors(errors: CompileErrorLike[]): number {
  return errors.filter((e) => e.severity === "error").length;
}

export interface CompileOutcome {
  success: boolean;
  pdf?: string | null;
}

/**
 * After a compile finishes, decide whether the proof pane should show a stale banner
 * while keeping the previous PDF visible.
 */
export function deriveProofStaleAfterCompile(
  hadPdfBeforeCompile: boolean,
  outcome: CompileOutcome,
  errors: CompileErrorLike[]
): { isStale: boolean; errorCount: number } {
  const errorCount = countCompileErrors(errors);

  if (outcome.success && outcome.pdf) {
    return { isStale: false, errorCount };
  }

  if (!outcome.success && hadPdfBeforeCompile) {
    return { isStale: true, errorCount };
  }

  return { isStale: false, errorCount };
}

export function shouldShowStaleProofBanner(
  isStale: boolean,
  pdfData: string | null
): boolean {
  return isStale && pdfData !== null && pdfData.length > 0;
}
