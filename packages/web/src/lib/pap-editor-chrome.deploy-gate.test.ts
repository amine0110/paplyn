import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-19/20/21 editor chrome deploy gate", () => {
  it("PAP-19: project header back control hard-navigates to /dashboard in-app", () => {
    const page = readSrc("app/project/[id]/page.tsx");
    expect(page).toContain('href="/dashboard"');
    expect(page).toContain('aria-label="Back to manuscripts"');
    expect(page).toContain("CHROME_ICON_BTN_MD");
    expect(page).toContain("handleDashboardBackClick");
    expect(page).not.toContain("window.confirm");
    expect(page).not.toMatch(/<Link[\s\S]*href="\/dashboard"/);

    const hardNav = readSrc("lib/hard-navigation.ts");
    expect(hardNav).toContain("window.location.assign");
    expect(hardNav).toContain('DASHBOARD_PATH = "/dashboard"');
  });

  it("PAP-20: shared chrome classes, buttons, and AI FAB expose pointer affordance", () => {
    const css = readSrc("app/globals.css");
    expect(css).toContain(".chrome-icon-btn-md");
    expect(css).toMatch(/\.chrome-icon-btn-md[\s\S]*cursor-pointer/);
    expect(readSrc("components/ui/button.tsx")).toContain("cursor-pointer");

    const fab = readSrc("components/ai-assistant-fab.tsx");
    expect(fab).toContain("cursor-pointer");
    expect(fab).toContain('aria-label="Open AI assistant"');
  });

  it("PAP-21: arXiv UI opens papers and cites without TeX import route", () => {
    const sidebar = readSrc("components/ai-sidebar.tsx");
    expect(sidebar).toContain("Open paper");
    expect(sidebar).toContain("onCiteArxivPaper");
    expect(sidebar).not.toContain("onImportArxiv");
    expect(sidebar).not.toMatch(/>\s*TeX\s*</);

    const page = readSrc("app/project/[id]/page.tsx");
    expect(page).toContain("handleCiteArxivPaper");
    expect(page).toContain("formatArxivBibtexEntry");
    expect(page).not.toContain("integrations/arxiv/import");

    expect(
      existsSync(join(ROOT, "app/api/projects/[id]/integrations/arxiv/import/route.ts"))
    ).toBe(false);

    const arxivLib = readSrc("lib/arxiv.ts");
    expect(arxivLib).toContain("formatArxivBibtexEntry");
    expect(arxivLib).not.toContain("fetchArxivSource");
    expect(arxivLib).not.toContain("JSZip");
  });
});
