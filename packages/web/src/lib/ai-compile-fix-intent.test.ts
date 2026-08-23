import { describe, expect, it } from "vitest";
import { detectFixCompileIntent } from "./ai-compile-fix-intent";

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
