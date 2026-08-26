import { describe, expect, it } from "vitest";
import { getAllDocs, getDocBySlug, getDocSections } from "@/lib/docs";

describe("docs registry", () => {
  it("loads markdown articles from content/docs", () => {
    const docs = getAllDocs();
    expect(docs.length).toBeGreaterThanOrEqual(2);

    const zotero = getDocBySlug("zotero");
    expect(zotero).not.toBeNull();
    expect(zotero?.title).toBe("Connect Zotero");
    expect(zotero?.section).toBe("Integrations");
    expect(zotero?.content).toContain("www.zotero.org/settings/keys");
    expect(zotero?.content).not.toMatch(/apiKey:\s*"[A-Za-z0-9]{8,}"/);
  });

  it("groups articles by section for the sidebar", () => {
    const sections = getDocSections();
    expect(sections.some((s) => s.section === "Integrations")).toBe(true);
    expect(sections.some((s) => s.section === "Get started")).toBe(true);

    const integrations = sections.find((s) => s.section === "Integrations");
    expect(integrations?.articles.some((a) => a.slug === "zotero")).toBe(true);
  });
});
