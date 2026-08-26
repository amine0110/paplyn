import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getGithubAuthConfig,
  getGoogleAuthConfig,
  getOrcidAuthConfig,
  isGithubAuthEnabled,
  isGoogleAuthEnabled,
  isOrcidAuthEnabled,
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

  it("returns null when ORCID env vars are missing", () => {
    delete process.env.ORCID_CLIENT_ID;
    delete process.env.ORCID_CLIENT_SECRET;

    expect(getOrcidAuthConfig()).toBeNull();
    expect(isOrcidAuthEnabled()).toBe(false);
  });

  it("returns null when only ORCID client id is set", () => {
    process.env.ORCID_CLIENT_ID = "orcid-client-id";
    delete process.env.ORCID_CLIENT_SECRET;

    expect(getOrcidAuthConfig()).toBeNull();
    expect(isOrcidAuthEnabled()).toBe(false);
  });

  it("returns config when both ORCID env vars are set", () => {
    process.env.ORCID_CLIENT_ID = "orcid-client-id";
    process.env.ORCID_CLIENT_SECRET = "orcid-client-secret";

    expect(getOrcidAuthConfig()).toEqual({
      clientId: "orcid-client-id",
      clientSecret: "orcid-client-secret",
    });
    expect(isOrcidAuthEnabled()).toBe(true);
  });
});
