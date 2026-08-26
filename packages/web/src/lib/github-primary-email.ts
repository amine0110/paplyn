export type GithubEmailEntry = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
};

/**
 * Pick GitHub's primary email for social-login identity.
 * Ignores verified secondaries and the public profile email from /user.
 * Returns null when GitHub has no primary email (fail closed).
 */
export function pickGithubPrimaryEmail(
  emails: GithubEmailEntry[] | null | undefined,
): { email: string; verified: boolean } | null {
  if (!emails?.length) return null;

  const primary = emails.find((entry) => entry.primary);
  if (!primary?.email) return null;

  return {
    email: primary.email.toLowerCase(),
    verified: primary.verified,
  };
}
