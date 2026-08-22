/** Matches `emailAndPassword.minPasswordLength` in auth.ts */
export const MIN_PASSWORD_LENGTH = 8;

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function validateProfileName(name: string): ValidationResult<string> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Display name is required" };
  }
  if (trimmed.length > 100) {
    return { ok: false, error: "Display name must be 100 characters or fewer" };
  }
  return { ok: true, data: trimmed };
}

export function validatePasswordChange(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  minLength?: number;
}): ValidationResult<{ currentPassword: string; newPassword: string }> {
  const minLength = input.minLength ?? MIN_PASSWORD_LENGTH;

  if (!input.currentPassword) {
    return { ok: false, error: "Current password is required" };
  }
  if (!input.newPassword) {
    return { ok: false, error: "New password is required" };
  }
  if (input.newPassword.length < minLength) {
    return {
      ok: false,
      error: `New password must be at least ${minLength} characters`,
    };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, error: "New passwords do not match" };
  }
  if (input.currentPassword === input.newPassword) {
    return { ok: false, error: "New password must be different from your current password" };
  }

  return {
    ok: true,
    data: {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    },
  };
}

/** Maps Better Auth change-password API errors to user-facing messages. */
export function mapPasswordChangeError(message: string | undefined): string {
  if (!message) return "Failed to change password";
  const lower = message.toLowerCase();
  if (lower.includes("invalid password") || lower.includes("incorrect")) {
    return "Current password is incorrect";
  }
  return message;
}
