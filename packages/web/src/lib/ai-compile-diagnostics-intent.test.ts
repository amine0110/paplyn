import { describe, expect, it } from "vitest";
import {
  classifyCompileDiagnosticsReview,
  classifyCompileDiagnosticsReviewFallback,
  COMPILE_DIAGNOSTICS_REVIEW_EXAMPLE_PHRASES,
} from "./ai-compile-diagnostics-intent";

describe("classifyCompileDiagnosticsReviewFallback", () => {
  it.each(COMPILE_DIAGNOSTICS_REVIEW_EXAMPLE_PHRASES)(
    "matches required example phrase: %s",
    (phrase) => {
      expect(classifyCompileDiagnosticsReviewFallback(phrase)).toBe(true);
    }
  );

  it("does not match unrelated manuscript chat", () => {
    expect(classifyCompileDiagnosticsReviewFallback("Summarize my introduction")).toBe(false);
    expect(classifyCompileDiagnosticsReviewFallback("Find papers on transformers")).toBe(false);
    expect(classifyCompileDiagnosticsReviewFallback("Rewrite the abstract")).toBe(false);
  });

  it("does not match compile-fix phrasing (handled separately)", () => {
    expect(
      classifyCompileDiagnosticsReviewFallback("Fix the compile errors in section 2")
    ).toBe(false);
  });
});

describe("classifyCompileDiagnosticsReview", () => {
  it("uses fallback when no model is provided", async () => {
    await expect(
      classifyCompileDiagnosticsReview({
        message: "why is the PDF failing",
      })
    ).resolves.toBe(true);
  });

  it("returns false during compile-fix turns", async () => {
    await expect(
      classifyCompileDiagnosticsReview({
        message: "check the log",
        compileFix: true,
      })
    ).resolves.toBe(false);
  });
});
