import { isGoogleAuthEnabled } from "@/lib/auth-providers";
import { SignupPageClient } from "./signup-form";

// Runtime env vars (GOOGLE_CLIENT_ID/SECRET) must be read per request, not at Docker build.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return <SignupPageClient googleEnabled={isGoogleAuthEnabled()} />;
}
