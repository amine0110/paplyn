"use client";

import Link from "next/link";
import { ChromeSessionActions } from "@/components/chrome-session-actions";
import { cn } from "@/components/ui/cn";
import {
  CHROME_LINK,
  CHROME_NAV_CLUSTER_MIN,
  CHROME_NAV_LINK_PAD,
  CHROME_NAV_THEME_SEP,
} from "@/lib/chrome-interactive";
import { PlicumWordmark } from "@/components/plicum-wordmark";
import { ThemeToggle } from "@/components/theme-toggle";

export function Nav() {
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-2 min-w-0">
        <Link href="/" className={cn("flex items-center shrink-0 min-w-0 pl-0.5 sm:pl-1", CHROME_LINK)}>
          <PlicumWordmark className="h-10" priority />
        </Link>

        <nav className={CHROME_NAV_CLUSTER_MIN}>
          <ThemeToggle compact className={CHROME_NAV_THEME_SEP} />
          <Link href="/docs" className={cn("text-sm", CHROME_NAV_LINK_PAD, CHROME_LINK)}>
            Docs
          </Link>
          <ChromeSessionActions />
        </nav>
      </div>
    </header>
  );
}
