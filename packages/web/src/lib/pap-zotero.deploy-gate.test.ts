import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getEnabledAiPlugins } from "@/lib/ai-plugins";
import { integrationLogoKeyFromId } from "@/lib/integrations/logo-keys";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-9 Zotero integration deploy gate", () => {
  it("registers Zotero in the plugin registry and composer tooling", () => {
    const plugins = getEnabledAiPlugins();
    expect(plugins.some((plugin) => plugin.id === "zotero")).toBe(true);

    const forcedTool = readSrc("lib/ai-plugins/forced-tool.ts");
    expect(forcedTool).toContain("search_zotero");

    const clientMeta = readSrc("lib/ai-plugins/client-meta.ts");
    expect(clientMeta).toContain("search_zotero");

    const page = readSrc("app/project/[id]/page.tsx");
    expect(page).toContain("handleCiteZoteroItem");
    expect(page).toContain("integrations/zotero/bibtex");
    expect(page).toContain("variant: \"success\"");

    const settings = readSrc("app/settings/page.tsx");
    expect(settings).toContain("PasswordInput");
    expect(settings).toContain("/api/settings/zotero");
  });

  it("shows the official Zotero logo on the landing strip when Zotero is registered", () => {
    expect(integrationLogoKeyFromId("zotero")).toBe("zotero");
    expect(existsSync(join(ROOT, "../public/integrations/zotero.svg"))).toBe(true);

    const logos = readSrc("components/integration-logos.tsx");
    expect(logos).toContain("zotero.svg");
    expect(logos).toContain("case \"zotero\"");
  });

  it("mocks Zotero API in unit tests without live keys", () => {
    const zoteroTest = readSrc("lib/zotero.test.ts");
    expect(zoteroTest).toContain("vi.stubGlobal(\"fetch\"");
    expect(zoteroTest).not.toMatch(/apiKey:\s*"[A-Za-z0-9]{8,}"/);
  });
});
