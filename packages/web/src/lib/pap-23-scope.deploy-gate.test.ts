import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PACKAGE_SCOPE } from "@/lib/product";

const ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(ROOT, "../../..");

/** Repo files that must use @paplyn workspace names, not legacy @quire. */
const WORKSPACE_SCOPE_FILES = [
  "package.json",
  "packages/web/package.json",
  "packages/collab/package.json",
  "packages/compiler/package.json",
  "packages/web/Dockerfile",
  "packages/collab/Dockerfile",
  "packages/compiler/Dockerfile",
  ".github/workflows/ci.yml",
  "README.md",
  "CONTRIBUTING.md",
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("PAP-23 npm scope deploy gate", () => {
  it("PACKAGE_SCOPE is paplyn", () => {
    expect(PACKAGE_SCOPE).toBe("paplyn");
  });

  it("root package name is paplyn", () => {
    const rootPkg = JSON.parse(readRepoFile("package.json")) as { name: string };
    expect(rootPkg.name).toBe("paplyn");
  });

  it("workspace packages use @paplyn scope", () => {
    const webPkg = JSON.parse(readRepoFile("packages/web/package.json")) as { name: string };
    const collabPkg = JSON.parse(readRepoFile("packages/collab/package.json")) as {
      name: string;
    };
    const compilerPkg = JSON.parse(readRepoFile("packages/compiler/package.json")) as {
      name: string;
    };

    expect(webPkg.name).toBe("@paplyn/web");
    expect(collabPkg.name).toBe("@paplyn/collab");
    expect(compilerPkg.name).toBe("@paplyn/compiler");
  });

  it("does not reference legacy @quire workspace names in npm/CI/Docker docs", () => {
    for (const relativePath of WORKSPACE_SCOPE_FILES) {
      expect(existsSync(join(REPO_ROOT, relativePath)), relativePath).toBe(true);
      const content = readRepoFile(relativePath);
      expect(content, relativePath).not.toContain("@quire/");
      expect(content, relativePath).not.toMatch(/filter @quire/);
    }
  });
});
