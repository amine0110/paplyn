"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);

  return (
    <div className="flex gap-4 justify-center">
      <Link href={isLoggedIn ? "/dashboard" : "/signup"}>
        <Button size="lg">{isLoggedIn ? "Open projects" : "Start writing"}</Button>
      </Link>
      {isLoggedIn ? (
        <Link href="/dashboard">
          <Button variant="outline" size="lg">Go to dashboard</Button>
        </Link>
      ) : (
        <Link href="/login">
          <Button variant="outline" size="lg">Sign in</Button>
        </Link>
      )}
    </div>
  );
}
