import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectCompileDiagnosticsIntent,
  detectFixCompileIntent,
} from "@/lib/ai-compile-fix-intent";
import { toolsForIntent } from "./ai-intent";
import { PLUGIN_TOOL_NAMES } from "@/lib/ai-plugins/forced-tool";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-37 compile diagnostics deploy gate", () => {
  const warningsMessage = "we have several warnings, can you check?";

  it("treats warning review as compile-aware without compile-fix", () => {
    expect(detectCompileDiagnosticsIntent(warningsMessage)).toBe(true);
    expect(detectCompileDiagnosticsIntent("can you see the warnings that are showing")).toBe(
      true
    );
    expect(detectFixCompileIntent(warningsMessage)).toBe(false);
  });

  it("ships compile diagnostics intent helpers and log patterns", () => {
    const intentSrc = readSrc("lib/ai-compile-diagnostics-intent.ts");
    expect(intentSrc).toContain("classifyCompileDiagnosticsReview");
    expect(intentSrc).toContain("classifyCompileDiagnosticsReviewFallback");
    expect(intentSrc).toMatch(/warnings?/);
    expect(intentSrc).toMatch(/compile log/i);
  });

  it("client always sends compile diagnostics on AI POST when available", () => {
    const sidebarSrc = readSrc("components/ai-sidebar.tsx");
    expect(sidebarSrc).toContain("compileLog");
    expect(sidebarSrc).toContain("compileErrors: hasDiagnostics ? compileErrors : undefined");
    expect(sidebarSrc).toContain("compileLog: compileLog.trim() ? compileLog : undefined");
    expect(sidebarSrc).not.toMatch(/paste.*log/i);
  });

  it("routes diagnostics review through LLM classifier with regex fallback", () => {
    const intentSrc = readSrc("lib/ai-compile-diagnostics-intent.ts");
    expect(intentSrc).toContain("classifyCompileDiagnosticsReview");
    expect(intentSrc).toContain("classifyCompileDiagnosticsReviewFallback");
    expect(intentSrc).toContain("reviewCompileDiagnostics");
  });

  it("server injects diagnostics and exposes get_compile_diagnostics", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("compileLog");
    expect(routeSrc).toContain("normalizeAiCompileDiagnostics");
    expect(routeSrc).toContain("buildCompileDiagnosticsContext");
    expect(routeSrc).toContain("classifyCompileDiagnosticsReview");
    expect(routeSrc).toContain("COMPILE_DIAGNOSTICS_REVIEW_SUFFIX");
    expect(routeSrc).toMatch(/includeCompileDiagnostics:\s*hasCompileDiagnostics/);

    const workspaceSrc = readSrc("lib/ai-plugins/workspace-tools.ts");
    expect(workspaceSrc).toContain("get_compile_diagnostics");
    expect(workspaceSrc).toContain("COMPILE_DIAGNOSTICS_WORKSPACE_SUFFIX");
    expect(workspaceSrc).toContain("never ask the user to paste");
  });

  it("mounts diagnostics tool for compile-aware edit turns", () => {
    const pluginTools = Object.fromEntries(
      PLUGIN_TOOL_NAMES.map((name) => [name, {}])
    );
    const workspaceTools = Object.fromEntries(
      ["list_files", "get_file", "get_compile_diagnostics", "apply_edit"].map((name) => [
        name,
        {},
      ])
    );

    const tools = toolsForIntent("edit", pluginTools, workspaceTools, {
      includeCompileDiagnostics: true,
    });

    expect("get_compile_diagnostics" in tools).toBe(true);
    expect("search_zotero" in tools).toBe(false);
  });
});
