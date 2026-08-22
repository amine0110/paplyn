/**
 * Client-side pairing of compile PDF + SyncTeX.
 * SyncTeX is never persisted in revisions; it must always match the in-memory PDF
 * from the same compile response (or be cleared).
 */

export interface CompileProofPayload {
  success: boolean;
  pdf?: string;
  synctex?: string;
}

export interface ProofArtifacts {
  pdf: string;
  /** null when compile omitted synctex or reverse sync must be disabled */
  synctex: string | null;
}

/**
 * Apply a compile API result to proof viewer state.
 * - Successful compile with PDF: replace both pdf and synctex atomically.
 * - Failed compile: leave prior artifacts unchanged (never update synctex alone).
 */
export function applyCompileProofResult(
  previous: ProofArtifacts | null,
  result: CompileProofPayload
): ProofArtifacts | null {
  if (result.success && result.pdf) {
    return {
      pdf: result.pdf,
      synctex: result.synctex ?? null,
    };
  }
  return previous;
}

/** History revisions store PDF only — drop any in-memory synctex. */
export function applyRestoredRevisionPdf(pdf: string): ProofArtifacts {
  return { pdf, synctex: null };
}
