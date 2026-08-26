type OAuthProviderConfig = { clientId: string; clientSecret: string };

/** Server-side Google OAuth configuration for Better Auth. */
export function getGoogleAuthConfig(): OAuthProviderConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleAuthEnabled(): boolean {
  return getGoogleAuthConfig() !== null;
}

/** Server-side GitHub OAuth configuration for Better Auth. */
export function getGithubAuthConfig(): OAuthProviderConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGithubAuthEnabled(): boolean {
  return getGithubAuthConfig() !== null;
}

/** Server-side ORCID OAuth configuration for Better Auth genericOAuth. */
export function getOrcidAuthConfig(): OAuthProviderConfig | null {
  const clientId = process.env.ORCID_CLIENT_ID?.trim();
  const clientSecret = process.env.ORCID_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isOrcidAuthEnabled(): boolean {
  return getOrcidAuthConfig() !== null;
}
