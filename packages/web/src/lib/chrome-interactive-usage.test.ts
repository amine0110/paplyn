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

  it("theme-toggle exposes a mobile cycle control and md+ segment group", () => {
    const src = readSource("components/theme-toggle.tsx");
    expect(src).toContain("ThemeCycleButton");
    expect(src).toContain("md:hidden");
    expect(src).toContain("hidden md:inline-flex");
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

  it("project topbar mobile overflow menu uses a 44px tap target and deferred dialog open", () => {
    const src = readSource("app/project/[id]/page.tsx");
    expect(src).toContain("openFromMobileMenu");
    expect(src).toContain('aria-label="More actions"');
    expect(src).toMatch(/h-11 w-11/);
    expect(src).toContain("openFromMobileMenu(() => setShowShare(true))");
    expect(src).toContain("openFromMobileMenu(() => setShowHistory(true))");
    expect(src).toContain("openFromMobileMenu(() => setShowSettings(true))");
  });

  it("dashboard project rows use a mobile actions menu and pointer-events-none hover reveal on md+", () => {
    const src = readSource("app/dashboard/page.tsx");
    expect(src).toContain('aria-label="Project actions"');
    expect(src).toContain("pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto");
    expect(src).toContain("hidden md:flex");
    expect(src).toContain("relative md:hidden");
  });

  it("dashboard header stacks on small screens and shortens action labels below sm", () => {
    const src = readSource("app/dashboard/page.tsx");
    expect(src).toContain("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between");
    expect(src).toContain("flex flex-wrap gap-2 sm:justify-end");
    expect(src).toContain('aria-label="Import GitHub"');
    expect(src).toContain('aria-label="Import zip"');
    expect(src).toContain('aria-label="New project"');
    expect(src).toContain("hidden sm:inline");
  });

  it("pdf preview defaults to 50% zoom on mobile via getDefaultPdfScale", () => {
    const previewSrc = readSource("components/pdf-preview.tsx");
    expect(previewSrc).toContain("getDefaultPdfScale");
    const scaleSrc = readSource("lib/pdf-preview-scale.ts");
    expect(scaleSrc).toContain("0.5");
    expect(scaleSrc).toContain("0.95");
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

  it("selection bubble chips use CHROME_CHIP and runs inline without opening sidebar", () => {
    const bubbleSrc = readSource("components/selection-ai-bubble.tsx");
    expect(bubbleSrc).toContain("CHROME_CHIP");
    expect(bubbleSrc).toContain("Rephrase");
    expect(bubbleSrc).toContain("Improve");
    expect(bubbleSrc).toContain("Cite");
    expect(bubbleSrc).toContain("Correct");
    expect(bubbleSrc).toContain("Write");
    expect(bubbleSrc).toContain("runInlineSelectionAi");

    const pageSrc = readSource("app/project/[id]/page.tsx");
    expect(pageSrc).toContain("<SelectionAiBubble");
    expect(pageSrc).not.toMatch(/isTextEditorFile\s*&&\s*!showAi/);
    expect(pageSrc).toContain("AiSidebarPanel");
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
