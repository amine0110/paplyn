import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCompileFixAiRequest,
  COMPILE_FIX_MESSAGE_LEAD_IN,
  COMPILE_FIX_USER_MESSAGE,
} from "@/lib/ai-compile-fix-intent";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const SAMPLE_ERRORS = [
  { severity: "error" as const, line: 42, message: "Undefined control sequence \\foo" },
];

describe("Fix with AI compile-error UI", () => {
  it("builds Fix-with-AI chat messages with quoted compile errors", () => {
    const message = buildCompileFixAiRequest({ errors: SAMPLE_ERRORS }).message;
    expect(message).toContain(COMPILE_FIX_MESSAGE_LEAD_IN);
    expect(message).toContain("Undefined control sequence \\foo");
    expect(message).not.toBe(COMPILE_FIX_USER_MESSAGE);
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

  it("project page passes compile errors into Fix-with-AI requests", () => {
    const src = readSource("app/project/[id]/page.tsx");
    expect(src).toContain("buildCompileFixAiRequest");
    expect(src).toContain("handleFixCompileWithAi");
    expect(src).toMatch(/onFixWithAi=\{handleFixCompileWithAi\}/);
    expect(src).toContain("errors: compileErrors");
    expect(src).toContain("log: compileLog");
    expect(src).toContain("setShowAi(true)");
    expect(src).not.toContain("handleSelectionAiAction");
    expect(src).toContain("pendingRequest={aiPendingRequest}");
    expect(src).toContain("buildCompileFixAutoRetryRequest");
    expect(src).toContain("errors: compileErrorsSnapshot");
    expect(src).toContain("log: compileLogSnapshot");
    expect(src).toContain("compile-fix-auto-retry");
    expect(src).toContain("fingerprintCompileErrors");
    expect(src).toContain("onCompileFixSessionStart");
    expect(src).toContain("onCompileFixRetryNoOp");
    expect(src).toContain("endCompileFixRetrySession");
    expect(src).toContain("scheduleCompileAfterAppliedActions");
  });

  it("ai sidebar uses error-bearing Fix-with-AI messages for the quick action", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("buildCompileFixAiRequest");
    expect(src).toContain("onCompileFixActionsApplied");
    expect(src).toContain("isCompileFixTurn: fixIntent");
  });
});
