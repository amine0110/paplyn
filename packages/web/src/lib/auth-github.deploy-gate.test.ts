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

describe("GitHub auth deploy gate", () => {
  it("auth-providers reads GitHub credentials from runtime env", () => {
    const src = readSrc("lib/auth-providers.ts");
    expect(src).toContain("process.env.GITHUB_CLIENT_ID");
    expect(src).toContain("process.env.GITHUB_CLIENT_SECRET");
    expect(src).toContain("getGithubAuthConfig");
    expect(src).toContain("isGithubAuthEnabled");
  });

  it("auth.ts wires github into Better Auth socialProviders when configured", () => {
    const src = readSrc("lib/auth.ts");
    expect(src).toContain("getGithubAuthConfig");
    expect(src).toContain("github:");
    expect(src).toContain("clientId: githubAuth.clientId");
    expect(src).toContain("clientSecret: githubAuth.clientSecret");
  });

  it("login and signup pages evaluate GitHub auth at request time", () => {
    const loginPage = readSrc("app/login/page.tsx");
    const signupPage = readSrc("app/signup/page.tsx");

    expect(loginPage).toContain("isGithubAuthEnabled()");
    expect(loginPage).toContain("githubEnabled=");
    expect(signupPage).toContain("isGithubAuthEnabled()");
    expect(signupPage).toContain("githubEnabled=");
  });

  it("login and signup forms gate the GitHub button on githubEnabled", () => {
    const loginForm = readSrc("app/login/login-form.tsx");
    const signupForm = readSrc("app/signup/signup-form.tsx");

    expect(loginForm).toContain("githubEnabled");
    expect(loginForm).toContain("GitHubSignInButton");
    expect(signupForm).toContain("githubEnabled");
    expect(signupForm).toContain("GitHubSignInButton");
  });

  it("GitHub sign-in button uses Better Auth github provider, callbackURL, and errorCallbackURL", () => {
    const src = readSrc("components/auth/github-sign-in-button.tsx");
    expect(src).toContain('provider: "github"');
    expect(src).toContain("callbackURL");
    expect(src).toContain("errorCallbackURL");
    expect(src).toContain("signOutAndStartSocialSignIn");
    expect(src).toContain("cursor-pointer");
    expect(src).toContain('fill="currentColor"');
    expect(src).toContain("Continue with GitHub");
  });

  it("does not hardcode GitHub OAuth secrets in source", () => {
    const files = [
      "lib/auth-providers.ts",
      "lib/auth.ts",
      "components/auth/github-sign-in-button.tsx",
      "app/login/page.tsx",
      "app/signup/page.tsx",
      "app/login/login-form.tsx",
      "app/signup/signup-form.tsx",
    ];

    for (const file of files) {
      const src = readSrc(file);
      expect(src).not.toMatch(/GITHUB_CLIENT_SECRET\s*=\s*["'][^"']+["']/);
      expect(src).not.toMatch(/GITHUB_CLIENT_ID\s*=\s*["'][^"']+["']/);
      expect(src).not.toContain("ghp_");
      expect(src).not.toContain("gho_");
    }
  });

  it.skipIf(!hasDeployConfigFiles)(
    "passes GitHub OAuth env through docker compose at runtime",
    () => {
      const compose = readRepoFile("docker-compose.yml");
      const composeProd = readRepoFile("docker-compose.prod.yml");
      const envExample = readRepoFile(".env.example");

      for (const file of [compose, composeProd, envExample]) {
        expect(file).toContain("GITHUB_CLIENT_ID");
        expect(file).toContain("GITHUB_CLIENT_SECRET");
      }

      const webService = compose.match(/  web:\n[\s\S]*?(?=\n  \w|$)/)?.[0] ?? "";
      const webBuildArgs = webService.match(/args:\n[\s\S]*?(?=\n    environment:)/)?.[0] ?? "";
      expect(webBuildArgs).not.toContain("GITHUB_CLIENT");

      const prodWebService = composeProd.match(/  web:\n[\s\S]*?(?=\n  \w|$)/)?.[0] ?? "";
      expect(prodWebService).toContain("GITHUB_CLIENT_ID");
      expect(prodWebService).toContain("GITHUB_CLIENT_SECRET");
      expect(prodWebService).not.toContain("args:");
    },
  );
});
