import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPILE_FIX_GET_FILE_BEFORE_EDIT,
  buildCompileFixCiteCommandHint,
  buildCompileFixTargetHint,
} from "@/lib/ai-compile-fix-context";
import {
  detectUndefinedCitationCommands,
  getAllowlistedPackagesForCompileErrors,
  validateNoInventedPackages,
} from "@/lib/ai-compile-fix-validation";
import { COMPILE_FIX_WORKSPACE_SUFFIX } from "@/lib/ai-plugins/workspace-tools";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-41 citep/natbib first-pass compile-fix", () => {
  it("allowlists natbib only for undefined citep/citet errors", () => {
    expect(
      getAllowlistedPackagesForCompileErrors([
        { message: "template.tex:64: Undefined control sequence. \\citep" },
      ])
    ).toEqual(["natbib"]);
    expect(detectUndefinedCitationCommands([{ message: "Missing } inserted" }])).toEqual([]);
    expect(
      validateNoInventedPackages(
        ["\\usepackage{amsmath}"],
        "\\usepackage{amsmath}\n\\usepackage{foo}"
      ).ok
    ).toBe(false);
    expect(
      validateNoInventedPackages(
        ["\\usepackage{amsmath}"],
        "\\usepackage{amsmath}\n\\usepackage{natbib}",
        { allowedPackages: ["natbib"] }
      ).ok
    ).toBe(true);
  });

  it("compile-fix suffix mentions cited-line-first read and natbib allowlist", () => {
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toMatch(/FIRST get_file/i);
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toContain("natbib");
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toMatch(/citep|citet/i);
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toContain(String(COMPILE_FIX_GET_FILE_BEFORE_EDIT));
  });

  it("target and cite hints steer one-turn complete fix", () => {
    const target = buildCompileFixTargetHint({ file: "template.tex", line: 64 });
    expect(target).toMatch(/small window around the cited error line/i);
    expect(target).toMatch(/not lines 1.100/i);

    const cite = buildCompileFixCiteCommandHint([
      { message: "template.tex:64: Undefined control sequence. \\citep" },
    ]);
    expect(cite).toMatch(/allowlisted/i);
    expect(cite).toMatch(/EVERY|every/i);
  });

  it("wires compileErrors and cite hint through the AI route", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("buildCompileFixCiteCommandHint");
    expect(routeSrc).toContain("compileErrors");
    expect(routeSrc).toContain("compileFixCiteCommandHint");
  });

  it("workspace tools pass compileErrors into validation context", () => {
    const toolsSrc = readSrc("lib/ai-plugins/workspace-tools.ts");
    expect(toolsSrc).toContain("compileErrors");
    expect(toolsSrc).toContain("COMPILE_FIX_GET_FILE_BEFORE_EDIT");
    expect(toolsSrc).toMatch(/Steered to cited error window/i);
  });
});
