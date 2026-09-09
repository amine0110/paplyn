"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { isPublicSignupsEnabled } from "@/lib/config";
import { SelfHostCta } from "@/components/self-host-cta";

export function LandingHero() {
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  const signupsEnabled = isPublicSignupsEnabled();

  if (isLoggedIn) {
    return (
      <div className="flex gap-4 justify-center">
        <Link href="/dashboard">
          <Button size="lg">Open projects</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" size="lg">Go to dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!signupsEnabled) {
    return <SelfHostCta size="lg" variant="hero" />;
  }

  return (
    <div className="flex gap-4 justify-center">
      <Link href="/signup">
        <Button size="lg">Start writing</Button>
      </Link>
      <Link href="/login">
        <Button variant="outline" size="lg">Sign in</Button>
      </Link>
    </div>
  );
}
