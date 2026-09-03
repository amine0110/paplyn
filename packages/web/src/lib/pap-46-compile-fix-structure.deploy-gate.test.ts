import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateCompileFixEdit,
  validateBibliographyStructure,
} from "@/lib/ai-compile-fix-validation";
import { tryBibliographyRecovery } from "@/lib/ai-compile-fix-bibliography-recovery";
import { sanitizeCompileFixSuccessClaims } from "@/lib/ai-compile-fix-success-gating";
import { COMPILE_FIX_WORKSPACE_SUFFIX } from "@/lib/ai-plugins/workspace-tools";
import { validateNoDummyManuscriptContent } from "@/lib/ai-compile-fix-validation";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function buildDistancePreprintFixture(): string {
  return [
    "\\documentclass[preprint]{article}",
    "\\usepackage{natbib}",
    "\\title{DISSTANCE}",
    "\\author{Mohammed El Amine Mokhtari\\\\UMONS}",
    "\\begin{document}",
    "\\maketitle",
    "\\begin{abstract}",
    "Abstract.",
    "\\end{abstract}",
    "\\section{Introduction}",
    "Body.",
    "\\bibliography{refs}",
    "\\end{document}",
  ].join("\n");
}

describe("PAP-46 compile-fix structure guard and success gating", () => {
  it("rejects misplaced References block before abstract (DISSTANCE-shaped)", () => {
    const content = buildDistancePreprintFixture();
    const preview = content.replace(
      "\\maketitle",
      "\\maketitle\n\\section{References}\n\\bibliography{refs}"
    );

    const result = validateCompileFixEdit({
      content,
      startLine: 6,
      endLine: 6,
      replace: "\\maketitle\n\\section{References}\n\\bibliography{refs}",
      previewContent: preview,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/references|bibliography/i);
    }
  });

  it("allows valid end-of-file bibliography", () => {
    const content = buildDistancePreprintFixture();
    expect(validateBibliographyStructure(content)).toEqual({ ok: true });
    expect(
      validateCompileFixEdit({
        content,
        startLine: 2,
        endLine: 2,
        replace: "\\usepackage{natbib}",
        previewContent: content,
      })
    ).toEqual({ ok: true });
  });

  it("does not emit fixed copy when compile errors remain", () => {
    const sanitized = sanitizeCompileFixSuccessClaims("The issue is fixed.", {
      compileFixRequest: true,
      appliedEditCount: 1,
      compileErrorCount: 4,
    });
    expect(sanitized).not.toMatch(/\bissue is fixed\b/i);
    expect(sanitized).toMatch(/recompile/i);
  });

  it("wires structure validation into compile-fix edit path", () => {
    const validationSrc = readSrc("lib/ai-compile-fix-validation.ts");
    expect(validationSrc).toContain("validateBibliographyStructure");
    expect(validationSrc).toMatch(/validateBibliographyStructure\(previewContent\)/);

    const actionsSrc = readSrc("lib/ai-client-actions.ts");
    expect(actionsSrc).toContain("validateCompileFixEdit");
  });

  it("wires success gating through resolveAssistantContent", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("sanitizeCompileFixSuccessClaims");
    expect(routeSrc).toContain("postEditCompileKnown");
    expect(routeSrc).toContain("autoCompileFixRetry");
    expect(routeSrc).toContain("tryBibliographyRecovery");
  });

  it("steers references fixes to the document end in compile-fix prompt", () => {
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toMatch(/END of the document/i);
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toMatch(/REMOVE or MOVE/i);
  });

  it("PAP-39 dummy-table/bib guards remain active", () => {
    const result = validateNoDummyManuscriptContent({
      replace: "\\begin{table}\\caption{x}\\end{table}",
      originalLines: [""],
    });
    expect(result.ok).toBe(false);
  });

  it("relocates damaged DISSTANCE-shaped manuscripts before calling the model", () => {
    const damaged = [
      "\\documentclass[preprint]{article}",
      "\\begin{document}",
      "\\maketitle",
      "\\section{References}",
      "\\bibliography{refs}",
      "\\begin{abstract}",
      "Abstract.",
      "\\end{abstract}",
      "\\section{Introduction}",
      "Body.",
      "\\end{document}",
    ].join("\n");
    const recovery = tryBibliographyRecovery({
      file: "main.tex",
      content: damaged,
      compileFixRequest: true,
      userMessage: "fix the references",
    });
    expect(recovery?.actions).toHaveLength(1);
    expect(recovery?.message).toMatch(/Moved the references block/i);
    expect(validateBibliographyStructure(recovery?.previewContent ?? "").ok).toBe(true);
  });
});
