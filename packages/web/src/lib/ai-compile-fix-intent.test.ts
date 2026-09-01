import { describe, expect, it } from "vitest";
import {
  buildCompileFixAiRequest,
  COMPILE_FIX_ACTION,
  COMPILE_FIX_USER_MESSAGE,
  detectCompileDiagnosticsIntent,
  detectFixCompileIntent,
} from "./ai-compile-fix-intent";

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

  it("detects free-text fix and compile intent", () => {
    expect(
      detectFixCompileIntent("Fix the errors in the project, it is not compiling")
    ).toBe(true);
    expect(detectFixCompileIntent("Why won't this compile?")).toBe(true);
    expect(detectFixCompileIntent("There are LaTeX errors in section 2")).toBe(true);
  });

  it("ignores unrelated chat", () => {
    expect(detectFixCompileIntent("Summarize my introduction")).toBe(false);
    expect(detectFixCompileIntent("Find papers about transformers")).toBe(false);
  });

  it("does not treat warning review as compile-fix", () => {
    expect(detectFixCompileIntent("we have several warnings, can you check?")).toBe(false);
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
    expect(detectCompileDiagnosticsIntent("Any overfull hbox issues?")).toBe(true);
    expect(detectCompileDiagnosticsIntent("Check the compile log for undefined references")).toBe(
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
