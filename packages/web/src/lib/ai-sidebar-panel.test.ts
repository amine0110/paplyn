import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("AI sidebar panel resize", () => {
  it("persists the latest dragged width via widthRef on pointerup", () => {
    const src = readSource("components/ai-sidebar-panel.tsx");
    expect(src).toContain("widthRef");
    expect(src).toMatch(/persistAiSidebarWidth\(widthRef\.current\)/);
    expect(src).not.toMatch(/persistAiSidebarWidth\(width\)/);
  });

  it("keeps pointer listeners stable during drag", () => {
    const src = readSource("components/ai-sidebar-panel.tsx");
    expect(src).toContain("}, [onPointerMove]);");
    expect(src).not.toContain("}, [onPointerMove, width]);");
  });
});
