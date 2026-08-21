import { describe, expect, it } from "vitest";
import {
  BRACE_COMMANDS,
  DOUBLE_BRACE_COMMANDS,
  commandNameFromLabel,
  completionInsertSpec,
  matchLatexCompletions,
} from "./latex-completion";

describe("commandNameFromLabel", () => {
  it("extracts the command name without braces", () => {
    expect(commandNameFromLabel("\\section")).toBe("section");
    expect(commandNameFromLabel("\\begin{document}")).toBe("begin");
  });
});

describe("completionInsertSpec", () => {
  it("inserts braces for section-like commands", () => {
    expect(completionInsertSpec("\\section")).toEqual({
      insert: "\\section{}",
      cursor: 9,
    });
    expect(BRACE_COMMANDS.has("section")).toBe(true);
  });

  it("inserts double braces for frac", () => {
    expect(completionInsertSpec("\\frac")).toEqual({
      insert: "\\frac{}{}",
      cursor: 6,
    });
    expect(DOUBLE_BRACE_COMMANDS.has("frac")).toBe(true);
  });

  it("keeps pre-braced labels unchanged", () => {
    expect(completionInsertSpec("\\begin{document}")).toEqual({
      insert: "\\begin{document}",
      cursor: "\\begin{document}".length,
    });
  });

  it("returns null for commands without arguments", () => {
    expect(completionInsertSpec("\\maketitle")).toBeNull();
    expect(completionInsertSpec("\\alpha")).toBeNull();
  });
});

describe("matchLatexCompletions", () => {
  it("suggests section commands after \\s", () => {
    const result = matchLatexCompletions({ textBefore: "\\s" });
    expect(result).not.toBeNull();
    expect(result!.options.some((o) => o.label === "\\section")).toBe(true);
    expect(result!.options.some((o) => o.label === "\\subsection")).toBe(true);
  });

  it("suggests environments inside \\begin{", () => {
    const result = matchLatexCompletions({ textBefore: "\\begin{" });
    expect(result).not.toBeNull();
    expect(result!.options.some((o) => o.label === "align")).toBe(true);
    expect(result!.options.some((o) => o.label === "equation")).toBe(true);
  });

  it("filters environments by typed prefix", () => {
    const result = matchLatexCompletions({ textBefore: "\\begin{eq" });
    expect(result).not.toBeNull();
    expect(result!.options.map((o) => o.label)).toEqual(["equation", "equation*"]);
  });

  it("returns null for bare backslash without explicit trigger", () => {
    expect(matchLatexCompletions({ textBefore: "\\" })).toBeNull();
  });

  it("allows bare backslash when explicitly triggered", () => {
    const result = matchLatexCompletions({ textBefore: "\\", explicit: true });
    expect(result).not.toBeNull();
    expect(result!.options.length).toBeGreaterThan(0);
  });
});
