import { isGithubAuthEnabled, isGoogleAuthEnabled } from "@/lib/auth-providers";
import { SignupPageClient } from "./signup-form";

// Runtime env vars (GOOGLE/GITHUB client id+secret) must be read per request, not at Docker build.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <SignupPageClient
      googleEnabled={isGoogleAuthEnabled()}
      githubEnabled={isGithubAuthEnabled()}
    />
  );
}
