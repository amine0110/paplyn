import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORKSPACE_SYSTEM_PROMPT } from "@/lib/ai-plugins/workspace-tools";
import {
  formatAppliedActionsSummary,
  isMashedPlanningText,
  MASHED_PLANNING_SAMPLE,
} from "@/lib/ai-planning-text-sanitize";

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

  it("formats applied edits as bullets with Done", () => {
    expect(
      formatAppliedActionsSummary([
        {
          type: "apply_edit",
          file: "template.tex",
          search: "a",
          replace: "b",
          label: "Inserted content after abstract in template.tex",
        },
      ])
    ).toContain("- Inserted content after abstract in template.tex");
    expect(
      formatAppliedActionsSummary([
        {
          type: "apply_edit",
          file: "template.tex",
          search: "a",
          replace: "b",
          label: "Inserted content after abstract in template.tex",
        },
      ])
    ).toMatch(/Done\.$/);
  });

  it("steers the model to past-tense readable summaries after edits", () => {
    expect(WORKSPACE_SYSTEM_PROMPT).toMatch(/past tense/i);
    expect(WORKSPACE_SYSTEM_PROMPT).toMatch(/Never use future-tense planning/i);
    expect(WORKSPACE_SYSTEM_PROMPT).toMatch(/Bullets plus a final "Done\." are fine/i);
  });
});
