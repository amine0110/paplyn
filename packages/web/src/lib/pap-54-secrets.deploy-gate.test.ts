import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(ROOT, "../../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

const SECRET_ENV_KEYS = [
  "SMTP_USER",
  "SMTP_PASS",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_SECRET",
  "ORCID_CLIENT_SECRET",
] as const;

describe("PAP-54 secrets deploy gate", () => {
  it("does not hardcode SMTP or OAuth client secrets in source", () => {
    const files = [
      "lib/email/send.ts",
      "lib/auth-providers.ts",
      "lib/auth.ts",
      "components/auth/google-sign-in-button.tsx",
      "components/auth/github-sign-in-button.tsx",
      "components/auth/orcid-sign-in-button.tsx",
    ];

    for (const file of files) {
      const src = readSrc(file);
      for (const key of SECRET_ENV_KEYS) {
        expect(src).not.toMatch(new RegExp(`${key}\\s*=\\s*["'][^"']+["']`));
      }
      expect(src).not.toMatch(/SMTP_PASS\s*[:=]\s*["'][^"']+["']/);
    }
  });

  it("keeps secret placeholders empty in .env.example", () => {
    const envExample = readRepoFile(".env.example");
    for (const key of SECRET_ENV_KEYS) {
      expect(envExample).toMatch(new RegExp(`${key}=\\s*$`, "m"));
    }
    expect(envExample).toMatch(/SMTP_HOST=\s*$/m);
    expect(envExample).not.toMatch(/SMTP_PASS=.+@/);
    expect(envExample).not.toContain("ghp_");
    expect(envExample).not.toContain("gho_");
  });

  it("documents OAuth callback paths and SMTP placement in configuration docs", () => {
    const configuration = readFileSync(
      join(ROOT, "../content/docs/configuration.md"),
      "utf8",
    );
    expect(configuration).toContain("/api/auth/callback/google");
    expect(configuration).toContain("/api/auth/callback/github");
    expect(configuration).toContain("/api/auth/callback/orcid");
    expect(configuration).toContain("SMTP_HOST");
    expect(configuration).toContain("SMTP_USER");
    expect(configuration).toContain("SMTP_PASS");
    expect(configuration).toContain("Link-only project invites");
    expect(configuration).not.toMatch(/SMTP_PASS=.*real.*password/i);
  });
});
