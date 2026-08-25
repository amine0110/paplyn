import { isGoogleAuthEnabled } from "@/lib/auth-providers";
import { LoginPageClient } from "./login-form";

export default function LoginPage() {
  return <LoginPageClient googleEnabled={isGoogleAuthEnabled()} />;
}
