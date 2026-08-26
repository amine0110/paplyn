import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOrcidGenericOAuthConfig,
  fetchOrcidPublicPrimaryEmail,
  normalizeOrcidId,
  ORCID_OAUTH_CALLBACK_PATH,
} from "@/lib/orcid-auth-provider";

describe("orcid-auth-provider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("documents the Better Auth 1.2 genericOAuth callback path", () => {
    expect(ORCID_OAUTH_CALLBACK_PATH).toBe("/api/auth/callback/orcid");
  });

  it("normalizes ORCID iD from userinfo sub URI", () => {
    expect(normalizeOrcidId("https://orcid.org/0000-0002-1825-0097")).toBe("0000-0002-1825-0097");
  });

  it("buildOrcidGenericOAuthConfig disables PKCE and requests openid + /read-public", () => {
    const config = buildOrcidGenericOAuthConfig({
      clientId: "APP-TEST",
      clientSecret: "secret",
    });

    expect(config.providerId).toBe("orcid");
    expect(config.pkce).toBe(false);
    expect(config.scopes).toEqual(["openid", "/read-public"]);
    expect(config.discoveryUrl).toBe("https://orcid.org/.well-known/openid-configuration");
  });

  it("getUserInfo returns null when ORCID does not expose a public primary email", async () => {
    const config = buildOrcidGenericOAuthConfig({
      clientId: "APP-TEST",
      clientSecret: "secret",
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: "https://orcid.org/0000-0002-1825-0097",
          name: "Ada Lovelace",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          email: [{ email: "hidden@example.com", primary: true, visibility: "private" }],
        }),
      });

    const result = await config.getUserInfo?.({ accessToken: "token" });
    expect(result).toBeNull();
  });

  it("getUserInfo returns primary public email and ORCID iD", async () => {
    const config = buildOrcidGenericOAuthConfig({
      clientId: "APP-TEST",
      clientSecret: "secret",
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: "https://orcid.org/0000-0002-1825-0097",
          name: "Ada Lovelace",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          email: [{ email: "Ada@Example.com", primary: true, visibility: "public" }],
        }),
      });

    const result = await config.getUserInfo?.({ accessToken: "token" });
    expect(result).toEqual({
      id: "0000-0002-1825-0097",
      sub: "0000-0002-1825-0097",
      email: "ada@example.com",
      emailVerified: true,
      name: "Ada Lovelace",
    });
  });

  it("fetchOrcidPublicPrimaryEmail calls the ORCID record email endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        email: [{ email: "user@example.com", primary: true, visibility: "public" }],
      }),
    });

    await expect(fetchOrcidPublicPrimaryEmail("0000-0002-1825-0097", "token")).resolves.toEqual({
      email: "user@example.com",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.orcid.org/v3.0/0000-0002-1825-0097/email",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
      }),
    );
  });
});
