import { describe, expect, it } from "vitest";
import {
  buildCompileFixAiRequest,
  COMPILE_FIX_ACTION,
  COMPILE_FIX_MESSAGE_LEAD_IN,
  COMPILE_FIX_USER_MESSAGE,
  detectFixCompileIntent,
  isCompileFixAiPrompt,
  isCompileFixErrorBearingMessage,
  resolveCompileRouting,
} from "./ai-compile-fix-intent";
import {
  classifyCompileDiagnosticsReviewFallback,
  COMPILE_DIAGNOSTICS_REVIEW_EXAMPLE_PHRASES,
  detectCompileDiagnosticsIntent,
} from "./ai-compile-diagnostics-intent";

const SAMPLE_ERRORS = [
  { severity: "error" as const, line: 18, message: "Undefined control sequence \\foo" },
];

describe("compile-fix request helpers", () => {
  it("exposes the canonical compile-fix user message", () => {
    expect(COMPILE_FIX_USER_MESSAGE).toBe("Find the error that stopping the compiler");
    expect(COMPILE_FIX_ACTION).toBe("explain-errors");
  });

  it("builds a pending AI request with quoted compile errors", () => {
    const request = buildCompileFixAiRequest({ errors: SAMPLE_ERRORS });
    expect(request.action).toBe("explain-errors");
    expect(request.message).toContain(COMPILE_FIX_MESSAGE_LEAD_IN);
    expect(request.message).toContain("Undefined control sequence \\foo");
    expect(request.message).not.toBe(COMPILE_FIX_USER_MESSAGE);
  });

  it("falls back to the bare chip prompt when no errors are provided", () => {
    expect(buildCompileFixAiRequest()).toEqual({
      message: COMPILE_FIX_USER_MESSAGE,
      action: "explain-errors",
    });
  });

  it("identifies the compile-fix chip prompt separately from user-visible errors", () => {
    expect(isCompileFixAiPrompt(COMPILE_FIX_USER_MESSAGE)).toBe(true);
    expect(isCompileFixAiPrompt("L18: Undefined control sequence \\foo")).toBe(false);
  });

  it("identifies error-bearing Fix-with-AI chat messages", () => {
    const message = buildCompileFixAiRequest({ errors: SAMPLE_ERRORS }).message;
    expect(isCompileFixErrorBearingMessage(message)).toBe(true);
    expect(isCompileFixAiPrompt(message)).toBe(false);
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

  it("detects error-bearing Fix-with-AI chat messages", () => {
    const message = buildCompileFixAiRequest({ errors: SAMPLE_ERRORS }).message;
    expect(detectFixCompileIntent(message)).toBe(true);
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

  it("routes error-bearing Fix-with-AI messages to compile-fix", () => {
    const message = buildCompileFixAiRequest({ errors: SAMPLE_ERRORS }).message;
    expect(
      resolveCompileRouting({
        message,
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
