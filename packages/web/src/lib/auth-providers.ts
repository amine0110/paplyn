/** Server-side Google OAuth configuration for Better Auth. */
export function getGoogleAuthConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleAuthEnabled(): boolean {
  return getGoogleAuthConfig() !== null;
}
