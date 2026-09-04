import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORKSPACE_SYSTEM_PROMPT } from "@/lib/ai-plugins/workspace-tools";
import { isMashedPlanningText, MASHED_PLANNING_SAMPLE } from "@/lib/ai-planning-text-sanitize";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-52 planning text sanitize deploy gate", () => {
  it("detects the screenshot mashed planning sample", () => {
    expect(isMashedPlanningText(MASHED_PLANNING_SAMPLE)).toBe(true);
  });

  it("wires bubble sanitizer through resolveAssistantContent", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("resolveAssistantBubbleContent");
    expect(routeSrc).toContain("ai-planning-text-sanitize");
  });

  it("steers the model to one short past-tense reply after edits", () => {
    expect(WORKSPACE_SYSTEM_PROMPT).toMatch(/ONE short past-tense sentence/i);
    expect(WORKSPACE_SYSTEM_PROMPT).toMatch(/Never paste a chain of planning/i);
  });
});
