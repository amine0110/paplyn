"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { PlicumWordmark } from "@/components/plicum-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { cn } from "@/components/ui/cn";
import { CHROME_ICON_BTN, CHROME_LINK } from "@/lib/chrome-interactive";
import type { DocSection } from "@/lib/docs/types";

interface DocsShellProps {
  sections: DocSection[];
  children: React.ReactNode;
}

export function DocsShell({ sections, children }: DocsShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileNav() {
    setMobileOpen(false);
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-5 min-w-0">
          <div className="flex items-center gap-2 min-w-0 shrink">
            <button
              type="button"
              className={cn(CHROME_ICON_BTN, "h-9 w-9 shrink-0 rounded-sm border border-border bg-paper lg:hidden")}
              aria-expanded={mobileOpen}
              aria-controls="docs-mobile-nav"
              aria-label={mobileOpen ? "Close docs menu" : "Open docs menu"}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <Link href="/" className={cn("flex min-w-0 shrink items-center", CHROME_LINK)}>
              <PlicumWordmark className="h-10" />
            </Link>
            <span className="hidden sm:inline text-ink-faint">/</span>
            <Link
              href="/docs"
              className={cn("hidden sm:inline text-sm font-medium text-ink-muted hover:text-ink truncate", CHROME_LINK)}
            >
              Docs
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle compact />
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
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden lg:block w-64 shrink-0 border-r border-border bg-surface/50 overflow-y-auto">
          <div className="sticky top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto p-4">
            <DocsSidebar sections={sections} />
          </div>
        </aside>

        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-ink/20 lg:hidden cursor-pointer"
            aria-label="Close docs menu"
            onClick={closeMobileNav}
          />
        )}

        <aside
          id="docs-mobile-nav"
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[min(100%,18rem)] border-r border-border bg-surface shadow-lg transition-transform duration-200 lg:hidden pt-14 overflow-y-auto",
            mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          )}
          aria-hidden={!mobileOpen}
        >
          <div className="p-4">
            <DocsSidebar sections={sections} onNavigate={closeMobileNav} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
