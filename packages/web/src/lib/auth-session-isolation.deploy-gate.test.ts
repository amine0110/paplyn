import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { pickGithubPrimaryEmail } from "./github-primary-email";

const ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(ROOT, "../../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("OAuth session isolation deploy gate", () => {
  it("enables same-email account linking but blocks different-email linking", () => {
    const src = readSrc("lib/auth.ts");
    expect(src).toContain("accountLinking");
    expect(src).toMatch(/enabled:\s*true/);
    expect(src).toMatch(/allowDifferentEmails:\s*false/);
    expect(src).not.toMatch(/allowDifferentEmails:\s*true/);
    expect(src).not.toMatch(/accountLinking:\s*\{[^}]*enabled:\s*false/s);
  });

  it("GitHub social login uses primary email only via pickGithubPrimaryEmail", () => {
    const auth = readSrc("lib/auth.ts");
    const helper = readSrc("lib/github-primary-email.ts");
    const provider = readSrc("lib/github-auth-provider.ts");

    expect(auth).toContain("buildGithubSocialProviderOptions");
    expect(provider).toContain("pickGithubPrimaryEmail");
    expect(provider).toContain("getUserInfo");
    expect(provider).toContain("user/emails");
    expect(provider).not.toMatch(/emails\[0\]/);
    expect(provider).not.toMatch(/find\(\(e\)\s*=>\s*e\.verified\)/);
    expect(helper).toContain("entry.primary");
    expect(helper).not.toMatch(/emails\[0\]/);
    expect(helper).not.toMatch(/!primary\.verified/);
  });

  it("pickGithubPrimaryEmail ignores mohammed@pycad.co when primary is amine1996", () => {
    expect(
      pickGithubPrimaryEmail([
        { email: "mohammed@pycad.co", primary: false, verified: true },
        { email: "mokhtari.amine1996@gmail.com", primary: true, verified: true },
      ]),
    ).toEqual({
      email: "mokhtari.amine1996@gmail.com",
      verified: true,
    });
  });

  it("social sign-in helper signs out before signIn.social", () => {
    const helper = readSrc("lib/auth-social.ts");
    expect(helper).toContain("signOutAndStartSocialSignIn");
    expect(helper).toContain("signOut()");
    expect(helper).toContain("signIn.social");
    expect(helper).toContain("errorCallbackURL");
    expect(helper).toMatch(/catch\s*\{/);
  });

  it("login and signup pages reject protocol-relative next redirects", () => {
    const loginPage = readSrc("app/login/page.tsx");
    const signupPage = readSrc("app/signup/page.tsx");
    const internalPath = readSrc("lib/internal-path.ts");

    expect(loginPage).toContain("resolveInternalNextPath");
    expect(signupPage).toContain("resolveInternalNextPath");
    expect(internalPath).toContain("!path.startsWith(\"//\")");
  });

  it("GitHub and Google buttons use the fresh social sign-in helper", () => {
    const github = readSrc("components/auth/github-sign-in-button.tsx");
    const google = readSrc("components/auth/google-sign-in-button.tsx");

    expect(github).toContain("signOutAndStartSocialSignIn");
    expect(github).toContain("errorCallbackURL");
    expect(google).toContain("signOutAndStartSocialSignIn");
    expect(google).toContain("errorCallbackURL");
  });

  it("login and signup pages redirect authenticated users away", () => {
    const loginPage = readSrc("app/login/page.tsx");
    const signupPage = readSrc("app/signup/page.tsx");

    expect(loginPage).toContain("getSession");
    expect(loginPage).toContain("redirect(");
    expect(signupPage).toContain("getSession");
    expect(signupPage).toContain("redirect(");
  });

  it("login and signup forms surface OAuth errors in-app", () => {
    const loginForm = readSrc("app/login/login-form.tsx");
    const signupForm = readSrc("app/signup/signup-form.tsx");

    expect(loginForm).toContain('error") === "oauth');
    expect(loginForm).toContain("OAUTH_ERROR_MESSAGE");
    expect(signupForm).toContain('error") === "oauth');
    expect(signupForm).toContain("OAUTH_ERROR_MESSAGE");
    expect(loginForm).toContain("buildSocialOAuthErrorCallbackURL");
    expect(signupForm).toContain("buildSocialOAuthErrorCallbackURL");
  });

  it("settings lists connected providers from account data", () => {
    const settings = readSrc("app/settings/page.tsx");
    const route = readSrc("app/api/auth/connected-providers/route.ts");

    expect(settings).toContain("/api/auth/connected-providers");
    expect(settings).toContain("labelConnectedProviders");
    expect(route).toContain("account.providerId");
  });
});
