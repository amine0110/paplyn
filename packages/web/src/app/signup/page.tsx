import { isGoogleAuthEnabled } from "@/lib/auth-providers";
import { SignupPageClient } from "./signup-form";

export default function SignupPage() {
  return <SignupPageClient googleEnabled={isGoogleAuthEnabled()} />;
}
