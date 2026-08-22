import { describe, it, expect } from "vitest";
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordChange,
  validateProfileName,
  mapPasswordChangeError,
} from "@/lib/profile-validation";

describe("validateProfileName", () => {
  it("accepts a trimmed non-empty name", () => {
    expect(validateProfileName("  Ada Lovelace  ")).toEqual({
      ok: true,
      data: "Ada Lovelace",
    });
  });

  it("rejects empty or whitespace-only names", () => {
    expect(validateProfileName("")).toEqual({
      ok: false,
      error: "Display name is required",
    });
    expect(validateProfileName("   ")).toEqual({
      ok: false,
      error: "Display name is required",
    });
  });

  it("rejects names longer than 100 characters", () => {
    const result = validateProfileName("a".repeat(101));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("100");
    }
  });
});

describe("validatePasswordChange", () => {
  it("accepts valid password change input", () => {
    expect(
      validatePasswordChange({
        currentPassword: "oldpassword",
        newPassword: "newpassword1",
        confirmPassword: "newpassword1",
      })
    ).toEqual({
      ok: true,
      data: {
        currentPassword: "oldpassword",
        newPassword: "newpassword1",
      },
    });
  });

  it("rejects missing current password", () => {
    expect(
      validatePasswordChange({
        currentPassword: "",
        newPassword: "newpassword1",
        confirmPassword: "newpassword1",
      })
    ).toEqual({
      ok: false,
      error: "Current password is required",
    });
  });

  it("rejects passwords shorter than the minimum length", () => {
    expect(
      validatePasswordChange({
        currentPassword: "oldpassword",
        newPassword: "short",
        confirmPassword: "short",
      })
    ).toEqual({
      ok: false,
      error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  });

  it("rejects mismatched confirmation", () => {
    expect(
      validatePasswordChange({
        currentPassword: "oldpassword",
        newPassword: "newpassword1",
        confirmPassword: "newpassword2",
      })
    ).toEqual({
      ok: false,
      error: "New passwords do not match",
    });
  });

  it("rejects when new password equals current password", () => {
    expect(
      validatePasswordChange({
        currentPassword: "samepassword",
        newPassword: "samepassword",
        confirmPassword: "samepassword",
      })
    ).toEqual({
      ok: false,
      error: "New password must be different from your current password",
    });
  });
});

describe("mapPasswordChangeError", () => {
  it("maps invalid password API errors to a clear message", () => {
    expect(mapPasswordChangeError("Invalid password")).toBe("Current password is incorrect");
    expect(mapPasswordChangeError("Password is incorrect")).toBe("Current password is incorrect");
  });

  it("passes through other error messages", () => {
    expect(mapPasswordChangeError("Session expired")).toBe("Session expired");
  });

  it("returns a default message when the API provides none", () => {
    expect(mapPasswordChangeError(undefined)).toBe("Failed to change password");
  });
});
