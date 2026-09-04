import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPILE_FIX_MAX_GET_FILE_CALLS_WITH_SNIPPET,
  COMPILE_FIX_MAX_STEPS,
  buildCompileFixTargetHint,
  extractLineSnippet,
  getCompileFixGetFileBudget,
  resolveCompileFixSnippet,
} from "@/lib/ai-compile-fix-context";
import { COMPILE_FIX_WORKSPACE_SUFFIX } from "@/lib/ai-plugins/workspace-tools";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const sampleTex = `\\documentclass{article}
\\begin{document}
Broken line
\\end{document}`;

describe("PAP-51 compile-fix snippet-first fast path", () => {
  it("caps get_file to at most 1 when cited location and snippet are present", () => {
    expect(COMPILE_FIX_MAX_GET_FILE_CALLS_WITH_SNIPPET).toBeLessThanOrEqual(1);
    expect(
      getCompileFixGetFileBudget({ hasCitedLocation: true, hasSnippet: true })
    ).toBe(COMPILE_FIX_MAX_GET_FILE_CALLS_WITH_SNIPPET);
  });

  it("injects cited error snippet and edit-first guidance into the target hint", () => {
    const snippet = extractLineSnippet(sampleTex, 3, 1);
    const hint = buildCompileFixTargetHint({ file: "main.tex", line: 3 }, { snippet });

    expect(hint).toContain("already have the cited error location and snippet");
    expect(hint).toContain("replace_lines or apply_edit");
    expect(hint).toContain("do NOT call list_files or get_file");
    expect(hint).toContain(snippet);
  });

  it("resolves snippets from project tex files for the cited location", () => {
    const texFiles = new Map([["main.tex", sampleTex]]);
    const snippet = resolveCompileFixSnippet({ file: "main.tex", line: 3 }, texFiles, 1);
    expect(snippet).toContain("> 3:");
    expect(snippet).toContain("Broken line");
  });

  it("wires snippet injection and tighter get_file budget through the AI route", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("resolveCompileFixSnippet");
    expect(routeSrc).toContain("citedErrorSnippet");
    expect(routeSrc).toContain("getCompileFixGetFileBudget");
    expect(routeSrc).toContain("COMPILE_FIX_MAX_STEPS");
    expect(routeSrc).toMatch(/buildCompileFixTargetHint\([\s\S]*snippet:/);
  });

  it("workspace tools honor citedErrorSnippet for budget and edit-first coverage", () => {
    const toolsSrc = readSrc("lib/ai-plugins/workspace-tools.ts");
    expect(toolsSrc).toContain("citedErrorSnippet");
    expect(toolsSrc).toContain("getCompileFixGetFileBudget");
    expect(toolsSrc).toContain("COMPILE_FIX_MAX_GET_FILE_CALLS_WITH_SNIPPET");
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toMatch(/cited error snippet is provided/i);
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toContain(
      String(COMPILE_FIX_MAX_GET_FILE_CALLS_WITH_SNIPPET)
    );
  });

  it("keeps compile-fix maxSteps low while PAP-38 auto-retry handles multi-round fixes", () => {
    expect(COMPILE_FIX_MAX_STEPS).toBe(6);
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("maxSteps: COMPILE_FIX_MAX_STEPS");
    expect(routeSrc).not.toMatch(/COMPILE_FIX_MAX_STEPS\s*=\s*12/);
  });
});
