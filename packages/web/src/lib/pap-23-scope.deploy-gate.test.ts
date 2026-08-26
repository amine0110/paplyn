import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PACKAGE_SCOPE } from "@/lib/product";

const ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(ROOT, "../../..");
const WEB_PACKAGE_JSON = join(ROOT, "../package.json");

/**
 * Monorepo files absent from the web-only Docker build context
 * (see packages/web/Dockerfile — only packages/web is copied into the image).
 */
const FULL_MONOREPO_SCOPE_FILES = [
  "packages/collab/package.json",
  "packages/compiler/package.json",
  "packages/web/Dockerfile",
  "packages/collab/Dockerfile",
  "packages/compiler/Dockerfile",
  ".github/workflows/ci.yml",
  "README.md",
  "CONTRIBUTING.md",
] as const;

const hasFullMonorepoCheckout = FULL_MONOREPO_SCOPE_FILES.every((relativePath) =>
  existsSync(join(REPO_ROOT, relativePath)),
);

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("PAP-23 npm scope deploy gate", () => {
  it("PACKAGE_SCOPE is paplyn", () => {
    expect(PACKAGE_SCOPE).toBe("paplyn");
  });

  it("web package name is @paplyn/web", () => {
    expect(existsSync(WEB_PACKAGE_JSON)).toBe(true);
    const webPkg = JSON.parse(readFileSync(WEB_PACKAGE_JSON, "utf8")) as { name: string };
    expect(webPkg.name).toBe("@paplyn/web");
    expect(readFileSync(WEB_PACKAGE_JSON, "utf8")).not.toContain("@quire/");
  });

  it.skipIf(!existsSync(join(REPO_ROOT, "package.json")))(
    "root package name is paplyn when root package.json is present",
    () => {
      const rootPkg = JSON.parse(readRepoFile("package.json")) as { name: string };
      expect(rootPkg.name).toBe("paplyn");
      expect(readRepoFile("package.json")).not.toContain("@quire/");
    },
  );

  it.skipIf(!hasFullMonorepoCheckout)(
    "workspace packages use @paplyn scope in full monorepo checkout",
    () => {
      const collabPkg = JSON.parse(readRepoFile("packages/collab/package.json")) as {
        name: string;
      };
      const compilerPkg = JSON.parse(readRepoFile("packages/compiler/package.json")) as {
        name: string;
      };

      expect(collabPkg.name).toBe("@paplyn/collab");
      expect(compilerPkg.name).toBe("@paplyn/compiler");
    },
  );

  it.skipIf(!hasFullMonorepoCheckout)(
    "does not reference legacy @quire workspace names in npm/CI/Docker docs",
    () => {
      const scopeFiles = [
        "package.json",
        "packages/web/package.json",
        ...FULL_MONOREPO_SCOPE_FILES,
      ];

      for (const relativePath of scopeFiles) {
        const filePath = join(REPO_ROOT, relativePath);
        expect(existsSync(filePath), relativePath).toBe(true);
        const content = readRepoFile(relativePath);
        expect(content, relativePath).not.toContain("@quire/");
        expect(content, relativePath).not.toMatch(/filter @quire/);
      }
    },
  );
});
