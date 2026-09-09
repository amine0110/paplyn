import { describe, it, expect } from "vitest";
import { pickGithubPrimaryEmail } from "./github-primary-email";

describe("pickGithubPrimaryEmail", () => {
  it("returns the primary email and ignores verified secondaries", () => {
    const result = pickGithubPrimaryEmail([
      {
        email: "other@example.com",
        primary: false,
        verified: true,
      },
      {
        email: "user@example.com",
        primary: true,
        verified: true,
      },
    ]);

    expect(result).toEqual({
      email: "user@example.com",
      verified: true,
    });
  });

  it("does not fall back to the first verified email when no primary exists", () => {
    expect(
      pickGithubPrimaryEmail([
        { email: "other@example.com", primary: false, verified: true },
        { email: "another@example.com", primary: false, verified: true },
      ]),
    ).toBeNull();
  });

  it("does not use a public profile email without a primary entry", () => {
    expect(pickGithubPrimaryEmail([])).toBeNull();
    expect(pickGithubPrimaryEmail(null)).toBeNull();
    expect(pickGithubPrimaryEmail(undefined)).toBeNull();
  });

  it("normalizes the primary email to lowercase", () => {
    expect(
      pickGithubPrimaryEmail([
        { email: "User@Example.com", primary: true, verified: true },
      ]),
    ).toEqual({
      email: "user@example.com",
      verified: true,
    });
  });

  it("returns unverified primary emails with verified: false", () => {
    expect(
      pickGithubPrimaryEmail([
        { email: "user@example.com", primary: true, verified: false },
      ]),
    ).toEqual({
      email: "user@example.com",
      verified: false,
    });
  });
});
