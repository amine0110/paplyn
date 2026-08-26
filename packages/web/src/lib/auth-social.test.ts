// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";

const signOut = vi.hoisted(() => vi.fn());
const signInSocial = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-client", () => ({
  signOut,
  signIn: {
    social: signInSocial,
  },
}));

describe("auth-social", () => {
  beforeEach(() => {
    vi.resetModules();
    signOut.mockReset();
    signInSocial.mockReset();
    signOut.mockResolvedValue(undefined);
    signInSocial.mockResolvedValue(undefined);
  });

  it("buildSocialOAuthErrorCallbackURL includes oauth error on login", async () => {
    const { buildSocialOAuthErrorCallbackURL } = await import("@/lib/auth-social");
    expect(buildSocialOAuthErrorCallbackURL("login")).toBe("/login?error=oauth");
  });

  it("buildSocialOAuthErrorCallbackURL preserves internal next path", async () => {
    const { buildSocialOAuthErrorCallbackURL } = await import("@/lib/auth-social");
    expect(buildSocialOAuthErrorCallbackURL("signup", "/invite/abc")).toBe(
      "/signup?error=oauth&next=%2Finvite%2Fabc",
    );
  });

  it("buildSocialOAuthErrorCallbackURL rejects protocol-relative next paths", async () => {
    const { buildSocialOAuthErrorCallbackURL } = await import("@/lib/auth-social");
    expect(buildSocialOAuthErrorCallbackURL("login", "//evil.example")).toBe("/login?error=oauth");
  });

  it("signOutAndStartSocialSignIn clears session before social sign-in", async () => {
    const { signOutAndStartSocialSignIn } = await import("@/lib/auth-social");

    await signOutAndStartSocialSignIn({
      provider: "github",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login?error=oauth",
    });

    expect(signOut).toHaveBeenCalledOnce();
    expect(signInSocial).toHaveBeenCalledOnce();
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(signInSocial.mock.invocationCallOrder[0]);
    expect(signInSocial).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login?error=oauth",
    });
  });

  it("signOutAndStartSocialSignIn still starts OAuth when signOut throws", async () => {
    signOut.mockRejectedValueOnce(new Error("network"));
    const { signOutAndStartSocialSignIn } = await import("@/lib/auth-social");

    await signOutAndStartSocialSignIn({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login?error=oauth",
    });

    expect(signOut).toHaveBeenCalledOnce();
    expect(signInSocial).toHaveBeenCalledOnce();
    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login?error=oauth",
    });
  });
});
