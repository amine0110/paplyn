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

    const slugs = getAllDocSlugs();
    expect(slugs).toContain("zotero");

    const zotero = getDocBySlug("zotero");
    expect(zotero?.content).toContain("https://www.zotero.org/settings/keys");
  });

  it("links Settings Zotero and landing footer to docs", () => {
    const settings = readSrc("app/settings/page.tsx");
    expect(settings).toContain('href="/docs/zotero"');
    expect(settings).toContain("How to get your Zotero key");

    const landing = readSrc("app/page.tsx");
    expect(landing).toContain('href="/docs"');
  });

  it("keeps docs content inside packages/web for Docker builds", () => {
    const dockerfile = readFileSync(join(ROOT, "../Dockerfile"), "utf8");
    expect(dockerfile).toContain("COPY packages/web ./packages/web");
    expect(dockerfile).not.toContain("packages/collab");
  });
});
