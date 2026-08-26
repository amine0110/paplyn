import { signIn, signOut } from "@/lib/auth-client";

export type SocialAuthProvider = "google" | "github";

export const OAUTH_ERROR_MESSAGE =
  "We could not complete sign-in with that provider. Try again or use email.";

/** Build an in-app OAuth failure URL for login or signup. */
export function buildSocialOAuthErrorCallbackURL(
  page: "login" | "signup",
  nextPath?: string,
): string {
  const params = new URLSearchParams({ error: "oauth" });
  const safeNext = nextPath?.startsWith("/") ? nextPath : undefined;
  if (safeNext && safeNext !== "/dashboard") {
    params.set("next", safeNext);
  }
  return `/${page}?${params.toString()}`;
}

/**
 * Social login from /login or /signup must start from a cleared session so a
 * leftover cookie cannot be silently reused or linked.
 */
export async function signOutAndStartSocialSignIn(options: {
  provider: SocialAuthProvider;
  callbackURL: string;
  errorCallbackURL: string;
}): Promise<void> {
  await signOut();
  await signIn.social({
    provider: options.provider,
    callbackURL: options.callbackURL,
    errorCallbackURL: options.errorCallbackURL,
  });
}
