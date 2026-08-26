import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllDocSlugs, getDocBySlug } from "@/lib/docs";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("Paplyn docs deploy gate", () => {
  it("exposes public /docs routes and filesystem-backed articles", () => {
    expect(existsSync(join(ROOT, "app/docs/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/docs/[slug]/page.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "../content/docs/zotero.md"))).toBe(true);
    expect(existsSync(join(ROOT, "../content/docs/orcid.md"))).toBe(true);

    const slugs = getAllDocSlugs();
    expect(slugs).toContain("zotero");
    expect(slugs).toContain("orcid");

    const zotero = getDocBySlug("zotero");
    expect(zotero?.content).toContain("https://www.zotero.org/settings/keys");

    const orcid = getDocBySlug("orcid");
    expect(orcid?.content).toContain("/api/auth/callback/orcid");
  });

  it("links Settings Zotero and landing footer to docs", () => {
    const settings = readSrc("app/settings/page.tsx");
    expect(settings).toContain('href="/docs/zotero"');
    expect(settings).toContain("How to get your Zotero key");
    expect(settings).toContain('href="/docs/orcid"');

    const landing = readSrc("app/page.tsx");
    expect(landing).toContain('href="/docs"');
  });

  it("exposes Docs in shared Nav chrome for signed-in and signed-out users", () => {
    const nav = readSrc("components/nav.tsx");
    expect(nav).toContain('href="/docs"');
    expect(nav).toContain("Docs");
    expect(nav).toContain("CHROME_LINK");
    expect(nav).toMatch(/ThemeToggle[\s\S]*href="\/docs"/);
  });

  it("uses session-aware chrome actions in docs shell header", () => {
    const docsShell = readSrc("components/docs/docs-shell.tsx");
    expect(docsShell).toContain("ChromeSessionActions");
    expect(docsShell).toContain('variant="docs"');

    const sessionActions = readSrc("components/chrome-session-actions.tsx");
    expect(sessionActions).toContain("useSession");
    expect(sessionActions).toContain("signOutAndLeave");
    expect(sessionActions).toContain('href="/dashboard"');
    expect(sessionActions).toContain('href="/settings"');
  });

  it("exposes Docs in the project editor header and mobile overflow menu", () => {
    const projectPage = readSrc("app/project/[id]/page.tsx");
    expect(projectPage).toContain('href="/docs"');
    expect(projectPage).toMatch(/Docs[\s\S]*CHROME_LINK|CHROME_LINK[\s\S]*Docs/);
    expect(projectPage).toMatch(/showMobileMenu[\s\S]*href="\/docs"/);
  });

  it("keeps docs content inside packages/web for Docker builds", () => {
    const dockerfile = readFileSync(join(ROOT, "../Dockerfile"), "utf8");
    expect(dockerfile).toContain("COPY packages/web ./packages/web");
    expect(dockerfile).not.toContain("packages/collab");
  });
});
