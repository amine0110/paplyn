import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCompileFixAiRequest,
  COMPILE_FIX_USER_MESSAGE,
} from "@/lib/ai-compile-fix-intent";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("Fix with AI compile-error UI", () => {
  it("uses the canonical compile-fix prompt", () => {
    expect(COMPILE_FIX_USER_MESSAGE).toBe("Find the error that stopping the compiler");
    expect(buildCompileFixAiRequest().message).toBe(COMPILE_FIX_USER_MESSAGE);
  });

  it("FixWithAiButton hides when errorCount is zero", () => {
    const src = readSource("components/fix-with-ai-button.tsx");
    expect(src).toContain("if (errorCount <= 0) return null");
    expect(src).toContain("Fix with AI");
    expect(src).toContain('variant="accent"');
  });

  it("PdfPreview stale banner wires Fix with AI behind error count", () => {
    const src = readSource("components/pdf-preview.tsx");
    expect(src).toContain("FixWithAiButton");
    expect(src).toContain("onFixWithAi");
    expect(src).toContain("errorCount={staleErrorCount}");
  });

  it("PdfPreview empty failed proof pane wires Fix with AI behind error count", () => {
    const src = readSource("components/pdf-preview.tsx");
    expect(src).toContain("Compilation failed");
    expect(src).toMatch(/!pdfData[\s\S]*FixWithAiButton/);
    expect(src).toMatch(/!pdfData[\s\S]*errorCount=\{staleErrorCount\}/);
  });

  it("CompilePanel error header wires Fix with AI behind error count", () => {
    const src = readSource("components/compile-panel.tsx");
    expect(src).toContain("FixWithAiButton");
    expect(src).toContain("onFixWithAi");
    expect(src).toContain("errorCount={errorList.length}");
  });

  it("project page opens AI sidebar and sends compile-fix request", () => {
    const src = readSource("app/project/[id]/page.tsx");
    expect(src).toContain("buildCompileFixAiRequest");
    expect(src).toContain("handleFixCompileWithAi");
    expect(src).toMatch(/handleSelectionAiAction\(buildCompileFixAiRequest\(\)\)/);
    expect(src).toMatch(/onFixWithAi=\{handleFixCompileWithAi\}/);
    expect(src).toContain("setShowAi(true)");
    expect(src).toContain("pendingRequest={aiPendingRequest}");
    expect(src).toContain("buildCompileFixAutoRetryRequest");
    expect(src).toContain("compile-fix-auto-retry");
    expect(src).toContain("onCompileFixSessionStart");
    expect(src).toContain("onCompileFixActionsApplied");
    expect(src).toContain("scheduleCompileAfterAppliedActions");
  });

  it("ai sidebar schedules compile after compile-fix actions apply", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("onCompileFixActionsApplied");
    expect(src).toContain("isCompileFixTurn: fixIntent");
  });
});
