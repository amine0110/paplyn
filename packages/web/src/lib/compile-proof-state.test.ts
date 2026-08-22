import { describe, it, expect } from "vitest";
import {
  applyCompileProofResult,
  applyRestoredRevisionPdf,
} from "./compile-proof-state";

describe("compile proof state (pdf + synctex pairing)", () => {
  const prior = { pdf: "OLD_PDF", synctex: "OLD_SYNCTEX" };

  it("replaces pdf and synctex together on successful compile", () => {
    const next = applyCompileProofResult(prior, {
      success: true,
      pdf: "NEW_PDF",
      synctex: "NEW_SYNCTEX",
    });
    expect(next).toEqual({ pdf: "NEW_PDF", synctex: "NEW_SYNCTEX" });
  });

  it("clears synctex when successful compile omits synctex field", () => {
    const next = applyCompileProofResult(prior, {
      success: true,
      pdf: "NEW_PDF",
    });
    expect(next).toEqual({ pdf: "NEW_PDF", synctex: null });
  });

  it("does not update synctex alone on failed compile (main branch bug)", () => {
    const next = applyCompileProofResult(prior, {
      success: false,
      synctex: "FAILED_RUN_SYNCTEX",
    });
    expect(next).toBe(prior);
    expect(next?.synctex).toBe("OLD_SYNCTEX");
    expect(next?.pdf).toBe("OLD_PDF");
  });

  it("does not update pdf alone on failed compile even when pdf is present", () => {
    const next = applyCompileProofResult(prior, {
      success: false,
      pdf: "ERROR_PDF",
      synctex: "ERROR_SYNCTEX",
    });
    expect(next).toBe(prior);
  });

  it("clears synctex when restoring a revision PDF from postgres", () => {
    expect(applyRestoredRevisionPdf("REVISION_PDF")).toEqual({
      pdf: "REVISION_PDF",
      synctex: null,
    });
  });
});
