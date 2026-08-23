import { describe, expect, it } from "vitest";
import {
  buildCompileFixAiRequest,
  COMPILE_FIX_ACTION,
  COMPILE_FIX_USER_MESSAGE,
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
});
