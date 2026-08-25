"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { signOutAndLeave } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { PlicumWordmark } from "@/components/plicum-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";

export function Nav() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-2 min-w-0">
        <Link href="/" className="flex items-center shrink-0 min-w-0 pl-0.5 sm:pl-1">
          <PlicumWordmark className="h-10" priority />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3 shrink min-w-0">
          <ThemeToggle compact />
          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink">
                Projects
              </Link>
              <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
                Settings
              </Link>
              {(session.user as { role?: string }).role === "admin" && (
                <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
                  Admin
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => void signOutAndLeave()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
