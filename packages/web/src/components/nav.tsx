"use client";

import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { PRODUCT } from "@/lib/product";

export function Nav() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-serif text-xl font-semibold text-navy">{PRODUCT.name}</span>
        </Link>

        <nav className="flex items-center gap-3">
          {session?.user ? (
            <>
              <Link href="/dashboard" className="text-sm text-ink-muted hover:text-ink">
                Projects
              </Link>
              <Link href="/settings" className="text-sm text-ink-muted hover:text-ink">
                Settings
              </Link>
              {config.isSelfHosted && (session.user as { role?: string }).role === "admin" && (
                <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
                  Admin
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
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
