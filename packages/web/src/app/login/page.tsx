import { isGoogleAuthEnabled } from "@/lib/auth-providers";
import { LoginPageClient } from "./login-form";

// Runtime env vars (GOOGLE_CLIENT_ID/SECRET) must be read per request, not at Docker build.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginPageClient googleEnabled={isGoogleAuthEnabled()} />;
}
