import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isPublicSignupsEnabled } from "./config";

describe("isPublicSignupsEnabled", () => {
  const originalPublic = process.env.PUBLIC_SIGNUPS_ENABLED;
  const originalNextPublic = process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED;

  beforeEach(() => {
    delete process.env.PUBLIC_SIGNUPS_ENABLED;
    delete process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED;
  });

  afterEach(() => {
    if (originalPublic === undefined) {
      delete process.env.PUBLIC_SIGNUPS_ENABLED;
    } else {
      process.env.PUBLIC_SIGNUPS_ENABLED = originalPublic;
    }
    if (originalNextPublic === undefined) {
      delete process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED = originalNextPublic;
    }
  });

  it("defaults to true when unset", () => {
    expect(isPublicSignupsEnabled()).toBe(true);
  });

  it("returns false when PUBLIC_SIGNUPS_ENABLED is false", () => {
    process.env.PUBLIC_SIGNUPS_ENABLED = "false";
    expect(isPublicSignupsEnabled()).toBe(false);
  });

  it("prefers NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED over PUBLIC_SIGNUPS_ENABLED", () => {
    process.env.PUBLIC_SIGNUPS_ENABLED = "true";
    process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED = "false";
    expect(isPublicSignupsEnabled()).toBe(false);
  });

  it("treats 0 as false", () => {
    process.env.PUBLIC_SIGNUPS_ENABLED = "0";
    expect(isPublicSignupsEnabled()).toBe(false);
  });
});
