"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { signOutAndLeave } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { CHROME_LINK } from "@/lib/chrome-interactive";

type ChromeSessionActionsVariant = "nav" | "docs";

export function ChromeSessionActions({ variant = "nav" }: { variant?: ChromeSessionActionsVariant }) {
  const { data: session } = useSession();

  if (session?.user) {
    return (
      <>
        <Link href="/dashboard" className={cn("text-sm", CHROME_LINK)}>
          Projects
        </Link>
        <Link href="/settings" className={cn("text-sm", CHROME_LINK)}>
          Settings
        </Link>
        {(session.user as { role?: string }).role === "admin" && (
          <Link href="/admin" className={cn("text-sm", CHROME_LINK)}>
            Admin
          </Link>
        )}
        <Button variant="ghost" size="sm" onClick={() => void signOutAndLeave()}>
          Sign out
        </Button>
      </>
    );
  }

  if (variant === "docs") {
    return (
      <>
        <Link href="/login" className={cn("hidden sm:inline text-sm", CHROME_LINK)}>
          Sign in
        </Link>
        <Link
          href="/signup"
          className={cn(
            "inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-light cursor-pointer"
          )}
        >
          Get started
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/login">
        <Button variant="ghost" size="sm">Sign in</Button>
      </Link>
      <Link href="/signup">
        <Button size="sm">Get started</Button>
      </Link>
    </>
  );
}
