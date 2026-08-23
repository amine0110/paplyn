import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { CHROME_SEND_BTN, CHROME_TOOLBAR_BTN } from "@/lib/chrome-interactive";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("workspace chrome class usage", () => {
  it("layout-mode-switcher inactive segments use CHROME_SEGMENT_INACTIVE", () => {
    const src = readSource("components/layout-mode-switcher.tsx");
    expect(src).toContain("CHROME_SEGMENT_INACTIVE");
    expect(src).toContain("CHROME_SEGMENT_ACTIVE");
  });

  it("theme-toggle inactive options use CHROME_SEGMENT_INACTIVE", () => {
    const src = readSource("components/theme-toggle.tsx");
    expect(src).toContain("CHROME_SEGMENT_INACTIVE");
    expect(src).toContain("CHROME_SEGMENT_ACTIVE");
  });

  it("editor toolbar uses CHROME_TOOLBAR_BTN for Find, Go to line, and spellcheck", () => {
    const src = readSource("components/editor-toolbar.tsx");
    expect(src).toContain("CHROME_TOOLBAR_BTN");
    expect(src).toContain("Find");
    expect(src).toContain("Go to line");
    expect(src).toContain("Spellcheck");
    expect(src).not.toMatch(/variant="ghost"/);
  });

  it("project topbar History, Settings, and Share use CHROME_TOOLBAR_BTN", () => {
    const src = readSource("app/project/[id]/page.tsx");
    expect(src).toContain("CHROME_TOOLBAR_BTN");
    expect(src).toMatch(/History[\s\S]*CHROME_TOOLBAR_BTN|CHROME_TOOLBAR_BTN[\s\S]*History/);
    expect(src).toMatch(/Settings[\s\S]*CHROME_TOOLBAR_BTN|CHROME_TOOLBAR_BTN[\s\S]*Settings/);
    expect(src).toMatch(/Share[\s\S]*CHROME_TOOLBAR_BTN|CHROME_TOOLBAR_BTN[\s\S]*Share/);
  });

  it("outline collapse controls use CHROME_ICON_BTN_SM", () => {
    const src = readSource("app/project/[id]/page.tsx");
    expect(src).toContain("CHROME_ICON_BTN_SM");
    expect(src).toContain("Collapse outline");
  });

  it("file tree toolbar actions use CHROME_ICON_BTN_SM", () => {
    const src = readSource("components/file-tree.tsx");
    expect(src).toContain("CHROME_ICON_BTN_SM");
    expect(src).toContain("New file");
    expect(src).toContain("New folder");
    expect(src).toContain("Download source");
    expect(src).toContain("Rename or move");
  });

  it("AI sidebar quick actions use CHROME_CHIP and send uses CHROME_SEND_BTN", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("CHROME_CHIP");
    expect(src).toContain("CHROME_SEND_BTN");
    expect(src).toContain("Fix errors");
    expect(src).toContain("Tighten");
    expect(src).toContain("Add citation");
    expect(src).toContain("Find papers");
  });

  it("selection bubble chips use CHROME_CHIP and renders without gating on AI sidebar", () => {
    const bubbleSrc = readSource("components/selection-ai-bubble.tsx");
    expect(bubbleSrc).toContain("CHROME_CHIP");
    expect(bubbleSrc).toContain("Rephrase");
    expect(bubbleSrc).toContain("Improve");
    expect(bubbleSrc).toContain("Cite");

    const pageSrc = readSource("app/project/[id]/page.tsx");
    expect(pageSrc).toContain("<SelectionAiBubble");
    expect(pageSrc).not.toMatch(/isTextEditorFile\s*&&\s*!showAi/);
  });

  it("globals.css defines accent-tint hover backgrounds for chrome classes", () => {
    const css = readSource("app/globals.css");
    expect(css).toContain(".chrome-hover");
    expect(css).toContain(".chrome-toolbar-btn");
    expect(css).toContain(".chrome-send-btn");
    expect(css).toContain("hover:bg-accent/15");
    expect(css).toContain("dark:hover:bg-accent/20");
    expect(css).toContain(".chrome-segment-inactive");
    expect(css).toContain(".chrome-chip");
    expect(css).toContain(".chrome-icon-btn-md");
    expect(css).toContain(".chrome-icon-btn-sm");
  });
});

describe("chrome-interactive class constants", () => {
  it("exports toolbar and send button classes", () => {
    expect(CHROME_TOOLBAR_BTN).toBe("chrome-toolbar-btn");
    expect(CHROME_SEND_BTN).toBe("chrome-send-btn");
  });
});
