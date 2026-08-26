import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getGithubAuthConfig,
  getGoogleAuthConfig,
  isGithubAuthEnabled,
  isGoogleAuthEnabled,
} from "@/lib/auth-providers";

describe("auth-providers", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("returns null when Google env vars are missing", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(getGoogleAuthConfig()).toBeNull();
    expect(isGoogleAuthEnabled()).toBe(false);
  });

  it("returns null when only Google client id is set", () => {
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(getGoogleAuthConfig()).toBeNull();
    expect(isGoogleAuthEnabled()).toBe(false);
  });

  it("returns config when both Google env vars are set", () => {
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";

    expect(getGoogleAuthConfig()).toEqual({
      clientId: "google-client-id",
      clientSecret: "google-client-secret",
    });
    expect(isGoogleAuthEnabled()).toBe(true);
  });

  it("returns null when GitHub env vars are missing", () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;

    expect(getGithubAuthConfig()).toBeNull();
    expect(isGithubAuthEnabled()).toBe(false);
  });

  it("returns null when only GitHub client id is set", () => {
    process.env.GITHUB_CLIENT_ID = "github-client-id";
    delete process.env.GITHUB_CLIENT_SECRET;

    expect(getGithubAuthConfig()).toBeNull();
    expect(isGithubAuthEnabled()).toBe(false);
  });

  it("returns config when both GitHub env vars are set", () => {
    process.env.GITHUB_CLIENT_ID = "github-client-id";
    process.env.GITHUB_CLIENT_SECRET = "github-client-secret";

    expect(getGithubAuthConfig()).toEqual({
      clientId: "github-client-id",
      clientSecret: "github-client-secret",
    });
    expect(isGithubAuthEnabled()).toBe(true);
  });
});
