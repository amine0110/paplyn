import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyCompileDiagnosticsReviewFallback,
  COMPILE_DIAGNOSTICS_REVIEW_EXAMPLE_PHRASES,
} from "@/lib/ai-compile-diagnostics-intent";
import {
  buildCompileDiagnosticsContext,
  formatCompileErrorLines,
} from "@/lib/ai-compile-fix-context";
import { mergeCompileDiagnostics } from "@/lib/compile-log-diagnostics";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-37 diagnostics review", () => {
  it.each(COMPILE_DIAGNOSTICS_REVIEW_EXAMPLE_PHRASES)(
    "classifies varied phrasing via fallback safety net: %s",
    (phrase) => {
      expect(classifyCompileDiagnosticsReviewFallback(phrase)).toBe(true);
    }
  );

  it("includes exact warning strings in diagnostics context when payload is present", () => {
    const warning = "Package hyperref Warning: Token not allowed in a PDF string (Unicode):";
    const merged = mergeCompileDiagnostics(
      [],
      `Some preamble\n${warning}\nOutput written on main.pdf`,
      { mainFile: "main.tex" }
    );

    const context = buildCompileDiagnosticsContext({
      errors: merged,
      log: "ignored when structured warnings exist",
      includeRawLog: false,
    });

    expect(context).toContain(warning);
    expect(context).toContain("Compile warnings:");
    expect(formatCompileErrorLines(merged)).toContain("hyperref");
  });

  it("forbids generic typical-warning guidance in diagnostics review suffix", () => {
    const workspaceSrc = readSrc("lib/ai-plugins/workspace-tools.ts");
    expect(workspaceSrc).toContain("COMPILE_DIAGNOSTICS_REVIEW_SUFFIX");
    expect(workspaceSrc).toMatch(/you'll typically see/i);
    expect(workspaceSrc).toMatch(/Do NOT invent a catalog/i);
    expect(workspaceSrc).toMatch(/get_compile_diagnostics/);
  });

  it("routes diagnostics review through LLM classifier with regex fallback", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("classifyCompileDiagnosticsReview");
    expect(routeSrc).toContain("compileDiagnosticsReviewTurn");
    expect(routeSrc).toMatch(/includeCompileDiagnostics:\s*hasCompileDiagnostics/);
    expect(routeSrc).toMatch(/includeFileContext.*compileDiagnosticsReview/s);
    expect(routeSrc).toContain("mergeCompileDiagnostics");
  });
});
