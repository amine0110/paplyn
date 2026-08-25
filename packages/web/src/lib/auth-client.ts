import { createAuthClient } from "better-auth/react";

// Same-origin: better-auth resolves from window.location in the browser and
// falls back to the relative path /api/auth — no build-time hostname required.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, updateUser, changePassword, requestPasswordReset, resetPassword } =
  authClient;
