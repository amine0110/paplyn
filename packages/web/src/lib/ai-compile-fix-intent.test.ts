import { describe, expect, it } from "vitest";
import {
  buildCompileFixAiRequest,
  COMPILE_FIX_ACTION,
  COMPILE_FIX_USER_MESSAGE,
  detectFixCompileIntent,
  resolveCompileRouting,
} from "./ai-compile-fix-intent";
import {
  classifyCompileDiagnosticsReviewFallback,
  COMPILE_DIAGNOSTICS_REVIEW_EXAMPLE_PHRASES,
  detectCompileDiagnosticsIntent,
} from "./ai-compile-diagnostics-intent";

describe("compile-fix request helpers", () => {
  it("exposes the canonical compile-fix user message", () => {
    expect(COMPILE_FIX_USER_MESSAGE).toBe("Find the error that stopping the compiler");
    expect(COMPILE_FIX_ACTION).toBe("explain-errors");
  });

  it("builds a pending AI request for compile-fix", () => {
    expect(buildCompileFixAiRequest()).toEqual({
      message: "Find the error that stopping the compiler",
      action: "explain-errors",
    });
  });
});

describe("detectFixCompileIntent", () => {
  it("detects explain-errors action", () => {
    expect(detectFixCompileIntent("anything", "explain-errors")).toBe(true);
  });

  it("detects explicit fix-the-errors phrasing", () => {
    expect(
      detectFixCompileIntent("Fix the errors in the project, it is not compiling")
    ).toBe(true);
    expect(detectFixCompileIntent("Fix the compile errors")).toBe(true);
    expect(detectFixCompileIntent(COMPILE_FIX_USER_MESSAGE)).toBe(true);
  });

  it("ignores unrelated chat", () => {
    expect(detectFixCompileIntent("Summarize my introduction")).toBe(false);
    expect(detectFixCompileIntent("Find papers about transformers")).toBe(false);
  });

  it("does not treat compile status or warning review as compile-fix", () => {
    expect(detectFixCompileIntent("we have several warnings, can you check?")).toBe(false);
    expect(detectFixCompileIntent("Why won't this compile?")).toBe(false);
    expect(detectFixCompileIntent("what's wrong with the compile")).toBe(false);
    expect(detectFixCompileIntent("did it compile clean")).toBe(false);
    expect(detectFixCompileIntent("what happened on the last build")).toBe(false);
  });
});

describe("compile review vs fix routing", () => {
  it.each(COMPILE_DIAGNOSTICS_REVIEW_EXAMPLE_PHRASES)(
    "routes review phrase to diagnostics review, not compile-fix: %s",
    (phrase) => {
      expect(detectFixCompileIntent(phrase)).toBe(false);
      expect(classifyCompileDiagnosticsReviewFallback(phrase)).toBe(true);
      expect(
        resolveCompileRouting({
          message: phrase,
          diagnosticsReview: true,
        })
      ).toEqual({ compileFix: false, diagnosticsReview: true });
    }
  );

  it("keeps explain-errors on the compile-fix path", () => {
    expect(
      resolveCompileRouting({
        message: "what's wrong with the compile",
        action: "explain-errors",
        diagnosticsReview: false,
      })
    ).toEqual({ compileFix: true, diagnosticsReview: false });
  });

  it("does not match abstract questions via broad can-you-see fallback", () => {
    expect(classifyCompileDiagnosticsReviewFallback("can you see the abstract")).toBe(false);
  });
});

describe("detectCompileDiagnosticsIntent", () => {
  it("detects warning and log review requests", () => {
    expect(detectCompileDiagnosticsIntent("we have several warnings, can you check?")).toBe(
      true
    );
    expect(detectCompileDiagnosticsIntent("can you see the warnings that are showing")).toBe(
      true
    );
    expect(detectCompileDiagnosticsIntent("why is the PDF failing")).toBe(true);
    expect(detectCompileDiagnosticsIntent("what happened on the last build")).toBe(true);
    expect(classifyCompileDiagnosticsReviewFallback("those yellow messages under the editor")).toBe(
      true
    );
  });

  it("ignores compile-fix requests", () => {
    expect(detectCompileDiagnosticsIntent("Fix the compile errors", "explain-errors")).toBe(
      false
    );
    expect(detectCompileDiagnosticsIntent("Fix the errors in the project")).toBe(false);
  });
});
