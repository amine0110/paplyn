import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(ROOT, "../../..");

const DEPLOY_CONFIG_FILES = [
  "docker-compose.yml",
  "docker-compose.prod.yml",
  ".env.example",
] as const;

const hasDeployConfigFiles = DEPLOY_CONFIG_FILES.every((relativePath) =>
  existsSync(join(REPO_ROOT, relativePath)),
);

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("ORCID auth deploy gate", () => {
  it("auth-providers reads ORCID credentials from runtime env", () => {
    const src = readSrc("lib/auth-providers.ts");
    expect(src).toContain("process.env.ORCID_CLIENT_ID");
    expect(src).toContain("process.env.ORCID_CLIENT_SECRET");
    expect(src).toContain("getOrcidAuthConfig");
    expect(src).toContain("isOrcidAuthEnabled");
  });

  it("auth.ts wires ORCID through Better Auth genericOAuth when configured", () => {
    const src = readSrc("lib/auth.ts");
    expect(src).toContain("getOrcidAuthConfig");
    expect(src).toContain("buildOrcidGenericOAuthConfig");
    expect(src).toContain("genericOAuth");
  });

  it("documents the Better Auth 1.2 callback path for providerId orcid", () => {
    const provider = readSrc("lib/orcid-auth-provider.ts");
    const docs = readSrc("../content/docs/orcid.md");
    expect(provider).toContain("/api/auth/callback/orcid");
    expect(docs).toContain("/api/auth/callback/orcid");
  });

  it("login and signup pages evaluate ORCID auth at request time", () => {
    const loginPage = readSrc("app/login/page.tsx");
    const signupPage = readSrc("app/signup/page.tsx");

    expect(loginPage).toContain("isOrcidAuthEnabled()");
    expect(loginPage).toContain("orcidEnabled=");
    expect(signupPage).toContain("isOrcidAuthEnabled()");
    expect(signupPage).toContain("orcidEnabled=");
  });

  it("login and signup forms gate the ORCID button on orcidEnabled", () => {
    const loginForm = readSrc("app/login/login-form.tsx");
    const signupForm = readSrc("app/signup/signup-form.tsx");

    expect(loginForm).toContain("orcidEnabled");
    expect(loginForm).toContain("OrcidSignInButton");
    expect(signupForm).toContain("orcidEnabled");
    expect(signupForm).toContain("OrcidSignInButton");
  });

  it("ORCID sign-in button uses official green iD mark and fresh social sign-in helper", () => {
    const src = readSrc("components/auth/orcid-sign-in-button.tsx");
    expect(src).toContain('provider: "orcid"');
    expect(src).toContain("signOutAndStartSocialSignIn");
    expect(src).toContain("#A6CE39");
    expect(src).toContain("Continue with ORCID");
    expect(src).not.toContain('fill="currentColor"');
  });

  it("does not add ORCID to the landing integrations marquee", () => {
    const logoKeys = readSrc("lib/integrations/logo-keys.ts");
    const integrationsStrip = readSrc("components/integrations-strip.tsx");
    expect(logoKeys).not.toContain("orcid");
    expect(integrationsStrip).not.toContain("orcid");
    expect(integrationsStrip).not.toContain("ORCID");
  });

  it("surfaces ORCID missing-email failures in-app", () => {
    const social = readSrc("lib/auth-social.ts");
    const loginForm = readSrc("app/login/login-form.tsx");
    expect(social).toContain("ORCID_NO_EMAIL_ERROR_MESSAGE");
    expect(loginForm).toContain('error") === "email_not_found"');
    expect(loginForm).toContain("ORCID_NO_EMAIL_ERROR_MESSAGE");
  });

  it("does not hardcode ORCID OAuth secrets in source", () => {
    const files = [
      "lib/auth-providers.ts",
      "lib/auth.ts",
      "lib/orcid-auth-provider.ts",
      "components/auth/orcid-sign-in-button.tsx",
      "app/login/page.tsx",
      "app/signup/page.tsx",
      "app/login/login-form.tsx",
      "app/signup/signup-form.tsx",
    ];

    for (const file of files) {
      const src = readSrc(file);
      expect(src).not.toMatch(/ORCID_CLIENT_SECRET\s*=\s*["'][^"']+["']/);
      expect(src).not.toMatch(/ORCID_CLIENT_ID\s*=\s*["']APP-[^"']+["']/);
    }
  });

  it.skipIf(!hasDeployConfigFiles)(
    "passes ORCID OAuth env through docker compose at runtime",
    () => {
      const compose = readRepoFile("docker-compose.yml");
      const composeProd = readRepoFile("docker-compose.prod.yml");
      const envExample = readRepoFile(".env.example");

      for (const file of [compose, composeProd, envExample]) {
        expect(file).toContain("ORCID_CLIENT_ID");
        expect(file).toContain("ORCID_CLIENT_SECRET");
      }

      const webService = compose.match(/  web:\n[\s\S]*?(?=\n  \w|$)/)?.[0] ?? "";
      const webBuildArgs = webService.match(/args:\n[\s\S]*?(?=\n    environment:)/)?.[0] ?? "";
      expect(webBuildArgs).not.toContain("ORCID_CLIENT");

      const prodWebService = composeProd.match(/  web:\n[\s\S]*?(?=\n  \w|$)/)?.[0] ?? "";
      expect(prodWebService).toContain("ORCID_CLIENT_ID");
      expect(prodWebService).toContain("ORCID_CLIENT_SECRET");
      expect(prodWebService).not.toContain("args:");
    },
  );
});
