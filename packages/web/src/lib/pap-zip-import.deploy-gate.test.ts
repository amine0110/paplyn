import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-33 zip import deploy gate", () => {
  it("submits from importZip state and does not require the native file input", () => {
    const page = readSrc("app/dashboard/page.tsx");

    const zipInputBlock = page.match(/id="import-zip"[\s\S]*?\/>/)?.[0] ?? "";
    expect(zipInputBlock).not.toContain("required");

    expect(page).toContain('formData.append("zip", importZip)');
    expect(page).toContain('if (!importZip)');
    expect(page).toContain('notice("Choose a .zip file to import")');
  });

  it("keeps GitHub import fields native-required", () => {
    const page = readSrc("app/dashboard/page.tsx");

    const githubRepoBlock = page.match(/id="github-repo"[\s\S]*?\/>/)?.[0] ?? "";
    const githubNameBlock = page.match(/id="github-import-name"[\s\S]*?\/>/)?.[0] ?? "";

    expect(githubRepoBlock).toContain("required");
    expect(githubNameBlock).toContain("required");
  });
});
