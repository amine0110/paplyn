import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPILE_FIX_MAX_AUTO_RETRIES,
  COMPILE_FIX_MAX_ROUNDS,
  decideCompileFixAutoRetry,
  fingerprintCompileErrors,
} from "@/lib/compile-fix-auto-retry";
import {
  NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX,
  COMPILE_FIX_WORKSPACE_SUFFIX,
  COMPILE_DIAGNOSTICS_REVIEW_SUFFIX,
  COMPILE_DIAGNOSTICS_WORKSPACE_SUFFIX,
} from "@/lib/ai-plugins/workspace-tools";
import { validateNoDummyManuscriptContent } from "@/lib/ai-compile-fix-validation";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-38 bounded compile-fix auto-retry", () => {
  it("allows up to three auto-retries (four rounds total)", () => {
    expect(COMPILE_FIX_MAX_ROUNDS).toBe(4);
    expect(COMPILE_FIX_MAX_AUTO_RETRIES).toBe(3);
  });

  it("wires fingerprinted retry decision in project page compile finally", () => {
    const pageSrc = readSrc("app/project/[id]/page.tsx");
    expect(pageSrc).toContain("fingerprintCompileErrors");
    expect(pageSrc).toMatch(
      /decideCompileFixAutoRetry\([\s\S]*fingerprintCompileErrors\(compileErrorsSnapshot\)/
    );
    expect(pageSrc).toContain("buildCompileFixAutoRetryRequest");
  });

  it("exports decideCompileFixAutoRetry no_progress reason", () => {
    expect(decideCompileFixAutoRetry).toBeDefined();
    expect(fingerprintCompileErrors).toBeDefined();
  });
});

describe("PAP-39 no dummy manuscript content on compile/warning fix", () => {
  it("includes standing no-dummy policy in compile-fix and diagnostics prompts", () => {
    expect(NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX).toMatch(/Never invent placeholder manuscript content/i);
    expect(NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX).toMatch(/do NOT create placeholder tables/i);
    expect(NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX).toMatch(/do NOT invent.*bibitem/i);

    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toContain(NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX);
    expect(COMPILE_DIAGNOSTICS_REVIEW_SUFFIX).toContain(NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX);
    expect(COMPILE_DIAGNOSTICS_WORKSPACE_SUFFIX).toContain(NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX);
  });

  it("rejects placeholder table/figure injection", () => {
    const result = validateNoDummyManuscriptContent({
      replace: "\\begin{table}\\caption{x}\\label{tab:corpus}\\end{table}",
      originalLines: [""],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/table or figure/i);
    }
  });

  it("rejects stub bibliography and bibitem injection", () => {
    const bib = validateNoDummyManuscriptContent({
      replace: "\\begin{thebibliography}{9}\\bibitem{mohammad2016}Dummy\\end{thebibliography}",
      originalLines: [""],
    });
    expect(bib.ok).toBe(false);

    const item = validateNoDummyManuscriptContent({
      replace: "\\bibitem{mohammad2016semeval} Placeholder paper.",
      originalLines: ["% bibliography"],
    });
    expect(item.ok).toBe(false);
  });

  it("rejects invented section blocks for warning silencing", () => {
    const result = validateNoDummyManuscriptContent({
      replace: "\\section{Gold Annotation Details}\nPlaceholder.",
      originalLines: [""],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/new section/i);
    }
  });

  it("allows adding a label on an existing float line", () => {
    const original = ["\\begin{figure}", "\\includegraphics{x}", "\\end{figure}"];
    const result = validateNoDummyManuscriptContent({
      replace: "\\begin{figure}\n\\includegraphics{x}\n\\label{fig:staffing}\n\\end{figure}",
      originalLines: original,
    });
    expect(result.ok).toBe(true);
  });

  it("enables manuscriptGuards on compile-fix and general workspace server paths", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toMatch(/compileFix:\s*true[\s\S]*manuscriptGuards:\s*true/);
    expect(routeSrc).toContain("manuscriptGuards: true");
  });

  it("classifies can-we-fix follow-ups as diagnostics review", () => {
    const intentSrc = readSrc("lib/ai-compile-diagnostics-intent.ts");
    expect(intentSrc).toMatch(/\\bcan we fix\\b/i);
    expect(intentSrc).toMatch(/\\bfix them\\b/i);
  });
});
