import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detectCompileDiagnosticsIntent } from "@/lib/ai-compile-fix-intent";
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
  const liveFailPhrase = "can you see the warnings that are showing";

  it("classifies live-fail phrasing as compile diagnostics intent", () => {
    expect(detectCompileDiagnosticsIntent(liveFailPhrase)).toBe(true);
    expect(detectCompileDiagnosticsIntent("we have several warnings, can you check?")).toBe(true);
  });

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

  it("omits project source from diagnostics review system prompt path", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("compileDiagnosticsReview");
    expect(routeSrc).toContain("COMPILE_DIAGNOSTICS_REVIEW_SUFFIX");
    expect(routeSrc).toMatch(/includeFileContext.*compileDiagnosticsReview/s);
    expect(routeSrc).toContain("mergeCompileDiagnostics");
  });
});
