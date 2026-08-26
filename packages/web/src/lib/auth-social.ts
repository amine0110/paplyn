import { signIn, signOut } from "@/lib/auth-client";
import { isInternalAppPath } from "@/lib/internal-path";

export type SocialAuthProvider = "google" | "github";

export const OAUTH_ERROR_MESSAGE =
  "We could not complete sign-in with that provider. Try again, or sign in with your email and password.";

/** Build an in-app OAuth failure URL for login or signup. */
export function buildSocialOAuthErrorCallbackURL(
  page: "login" | "signup",
  nextPath?: string,
): string {
  const params = new URLSearchParams({ error: "oauth" });
  const safeNext = isInternalAppPath(nextPath) ? nextPath : undefined;
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
  try {
    await signOut();
  } catch {
    // Already signed out or transient network error — still start OAuth.
  }
  await signIn.social({
    provider: options.provider,
    callbackURL: options.callbackURL,
    errorCallbackURL: options.errorCallbackURL,
  });
}
