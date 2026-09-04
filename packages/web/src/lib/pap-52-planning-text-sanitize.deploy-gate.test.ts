import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WORKSPACE_SYSTEM_PROMPT } from "@/lib/ai-plugins/workspace-tools";
import {
  DOCUMENT_CLASS_PLANNING_SAMPLE,
  formatAppliedActionsSummary,
  hasProgressivePlanning,
  isMashedPlanningText,
  MASHED_PLANNING_SAMPLE,
  resolveAssistantBubbleContent,
} from "@/lib/ai-planning-text-sanitize";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-52 planning text sanitize deploy gate", () => {
  it("detects the screenshot mashed planning sample", () => {
    expect(isMashedPlanningText(MASHED_PLANNING_SAMPLE)).toBe(true);
    expect(isMashedPlanningText(DOCUMENT_CLASS_PLANNING_SAMPLE)).toBe(true);
    expect(hasProgressivePlanning(DOCUMENT_CLASS_PLANNING_SAMPLE)).toBe(true);
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
    expect(WORKSPACE_SYSTEM_PROMPT).toMatch(/present-continuous narration/i);
    expect(WORKSPACE_SYSTEM_PROMPT).toMatch(/Bullets plus a final "Done\." are fine/i);
  });

  it("sanitizes the document-class planning screenshot on the done path", () => {
    const resolved = resolveAssistantBubbleContent({
      rawText: DOCUMENT_CLASS_PLANNING_SAMPLE,
      actions: [
        {
          type: "apply_edit",
          file: "template.tex",
          search: "a",
          replace: "b",
          label: "Added \\documentclass{article} at line 3 in template.tex",
        },
      ],
      result: {
        text: "",
        toolCalls: [],
        toolResults: [],
        steps: [],
        response: { messages: [] },
      } as Parameters<typeof resolveAssistantBubbleContent>[0]["result"],
    });

    expect(resolved).not.toMatch(/\bI'll\b/i);
    expect(resolved).not.toMatch(/^Fixing\b/m);
    expect(resolved).toMatch(/Done\.$/);
  });
});
