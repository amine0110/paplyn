export const MIN_PASSWORD_LENGTH = 8;

export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}

export function validatePasswordPair(
  password: string,
  confirmPassword: string
): { valid: true } | { valid: false; error: string } {
  if (!password || !confirmPassword) {
    return { valid: false, error: "Both password fields are required." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (!passwordsMatch(password, confirmPassword)) {
    return { valid: false, error: "Passwords do not match." };
  }
  return { valid: true };
}
