import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getForcedToolPrompt } from "@/lib/ai-plugins/forced-tool";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("ai route forced-tool wiring", () => {
  it("injects the plugin display name when forcedTool is set", () => {
    const prompt = getForcedToolPrompt("cite_from_doi");
    expect(prompt).toContain("Cite DOI / Crossref");
    expect(prompt).toContain("this tool");
    expect(prompt).toContain("cite_from_doi");
  });

  it("restores type-safe toolChoice for forced plugin tasks", () => {
    const routeSrc = readSource("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("resolveForcedToolChoice");
    expect(routeSrc).toContain('toolChoice: { type: "tool", toolName: forcedToolName }');
    expect(routeSrc).toContain("getForcedToolPrompt(data.forcedTool)");
    expect(routeSrc).toMatch(
      /data\.action && !\(data\.forcedTool && isRegisteredPluginToolName\(data\.forcedTool\)\)/
    );
  });
});
