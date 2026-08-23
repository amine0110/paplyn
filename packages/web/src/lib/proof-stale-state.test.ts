import { describe, expect, it } from "vitest";
import {
  countCompileErrors,
  deriveProofStaleAfterCompile,
  shouldShowStaleProofBanner,
} from "./proof-stale-state";

describe("countCompileErrors", () => {
  it("counts only error-severity items", () => {
    expect(
      countCompileErrors([
        { severity: "error" },
        { severity: "warning" },
        { severity: "error" },
      ])
    ).toBe(2);
  });
});

describe("deriveProofStaleAfterCompile", () => {
  it("clears stale on successful compile with PDF", () => {
    const result = deriveProofStaleAfterCompile(
      true,
      { success: true, pdf: "abc" },
      [{ severity: "warning" }]
    );
    expect(result).toEqual({ isStale: false, errorCount: 0 });
  });

  it("marks stale when compile fails after a prior successful PDF", () => {
    const errors = [
      { severity: "error" as const },
      { severity: "error" as const },
      { severity: "warning" as const },
    ];
    const result = deriveProofStaleAfterCompile(
      true,
      { success: false },
      errors
    );
    expect(result).toEqual({ isStale: true, errorCount: 2 });
  });

  it("does not mark stale on first-ever failed compile with no prior PDF", () => {
    const result = deriveProofStaleAfterCompile(
      false,
      { success: false },
      [{ severity: "error" }]
    );
    expect(result).toEqual({ isStale: false, errorCount: 1 });
  });

  it("does not mark stale when compile fails but there was never a PDF", () => {
    const result = deriveProofStaleAfterCompile(
      false,
      { success: false, pdf: null },
      [{ severity: "error" }, { severity: "error" }]
    );
    expect(result).toEqual({ isStale: false, errorCount: 2 });
  });
});

describe("shouldShowStaleProofBanner", () => {
  it("shows banner only when stale and PDF bytes exist", () => {
    expect(shouldShowStaleProofBanner(true, "pdf-bytes")).toBe(true);
    expect(shouldShowStaleProofBanner(true, null)).toBe(false);
    expect(shouldShowStaleProofBanner(false, "pdf-bytes")).toBe(false);
    expect(shouldShowStaleProofBanner(true, "")).toBe(false);
  });
});
