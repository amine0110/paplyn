import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initialInlineStatusForAction } from "@/lib/selection-ai-inline";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("selection-ai-inline", () => {
  it("shows applying edit status for rewrite actions", () => {
    expect(initialInlineStatusForAction("rephrase")).toBe("Applying edit");
    expect(initialInlineStatusForAction("correct")).toBe("Applying edit");
    expect(initialInlineStatusForAction("write", "make this a footnote")).toBe("Applying edit");
  });

  it("selection bubble runs inline without opening sidebar", () => {
    const bubbleSrc = readSource("components/selection-ai-bubble.tsx");
    expect(bubbleSrc).toContain("runInlineSelectionAi");
    expect(bubbleSrc).not.toContain("setShowAi");
    expect(bubbleSrc).toContain("Correct");
    expect(bubbleSrc).toContain("Write");

    const pageSrc = readSource("app/project/[id]/page.tsx");
    expect(pageSrc).not.toContain("handleSelectionAiAction");
    expect(pageSrc).toContain("inlineContext");
    expect(pageSrc).not.toContain("onAction={handleSelectionAiAction}");
  });

  it("inline request marks inlineSelection on the API payload", () => {
    const src = readSource("lib/selection-ai-inline.ts");
    expect(src).toContain("inlineSelection: hasSelection");
  });

  it("API route supports correct and write actions with replace hint", () => {
    const src = readSource("app/api/projects/[id]/ai/route.ts");
    expect(src).toContain('"correct"');
    expect(src).toContain('"write"');
    expect(src).toContain("INLINE_SELECTION_SUFFIX");
    expect(src).toContain("inlineSelection");
  });

  it("apply-ai-client-actions uses captured selection range", () => {
    const src = readSource("lib/apply-ai-client-actions.ts");
    expect(src).toContain("selectionRange");
    expect(src).toContain("resolveEditorRange");
  });
});
