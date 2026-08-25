"use client";

import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type GoogleSignInButtonProps = {
  callbackURL?: string;
  className?: string;
};

export function GoogleSignInButton({ callbackURL = "/dashboard", className }: GoogleSignInButtonProps) {
  async function handleGoogle() {
    await signIn.social({
      provider: "google",
      callbackURL,
    });
  }

  return (
    <Button type="button" variant="outline" className={className ?? "w-full"} onClick={handleGoogle}>
      Continue with Google
    </Button>
  );
}
