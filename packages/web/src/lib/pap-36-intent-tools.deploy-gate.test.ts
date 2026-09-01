import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLUGIN_TOOL_NAMES } from "@/lib/ai-plugins/forced-tool";
import { toolsForIntent } from "./ai-intent";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-36 intent-based tool mounting deploy gate", () => {
  it("ships ai-intent helpers with toolsForIntent", () => {
    const intentSrc = readSrc("lib/ai-intent.ts");
    expect(intentSrc).toContain("export function toolsForIntent");
    expect(intentSrc).toContain("export async function classifyAiIntent");
    expect(intentSrc).toContain("wrapPluginToolsWithPolicy");
  });

  it("routes unforced chat through toolsForIntent instead of spreading all plugins", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("classifyAiIntent");
    expect(routeSrc).toContain("toolsForIntent");
    expect(routeSrc).toContain("toolsForForcedPlugin");
    expect(routeSrc).toContain("wrapPluginToolsWithPolicy");
    expect(routeSrc).not.toMatch(
      /:\s*streamText\(\{[\s\S]*tools:\s*\{\s*\.\.\.pluginTools,\s*\.\.\.workspaceTools\s*\}/
    );
    expect(routeSrc).not.toContain("asPluginToolsRecord");
    expect(routeSrc).not.toContain("pluginToolsRecord");
  });

  it("classifies intent before resolveAiPlugins", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    const classifyIndex = routeSrc.indexOf("classifyAiIntent");
    const resolveIndex = routeSrc.indexOf("resolveAiPlugins");
    expect(classifyIndex).toBeGreaterThan(-1);
    expect(resolveIndex).toBeGreaterThan(classifyIndex);
  });

  it("omits search_zotero from unforced edit and chat tool maps", () => {
    const pluginTools = Object.fromEntries(
      PLUGIN_TOOL_NAMES.map((name) => [name, {}])
    );
    const workspaceTools = Object.fromEntries(
      ["list_files", "get_file", "apply_edit"].map((name) => [name, {}])
    );

    const editTools = toolsForIntent("edit", pluginTools, workspaceTools);
    const chatTools = toolsForIntent("chat", pluginTools, workspaceTools);

    expect("search_zotero" in editTools).toBe(false);
    expect("search_zotero" in chatTools).toBe(false);
    expect("apply_edit" in editTools).toBe(true);
    expect("list_files" in chatTools).toBe(true);
    expect("apply_edit" in chatTools).toBe(false);
  });

  it("keeps forced toolChoice and compile-fix workspace-only paths", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain('toolChoice: { type: "tool", toolName: forcedToolName }');
    expect(routeSrc).toContain("toolsForForcedPlugin(forcedToolName");
    expect(routeSrc).toContain("tools: workspaceTools");
    expect(routeSrc).toContain("compileFix: compileFixRequest");
  });
});
