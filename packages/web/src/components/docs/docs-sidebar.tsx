"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { CHROME_LINK } from "@/lib/chrome-interactive";
import type { DocSection } from "@/lib/docs/types";

interface DocsSidebarProps {
  sections: DocSection[];
  onNavigate?: () => void;
  className?: string;
}

export function DocsSidebar({ sections, onNavigate, className }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("space-y-6", className)} aria-label="Documentation">
      <div>
        <Link
          href="/docs"
          onClick={onNavigate}
          className={cn(
            "block rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
            pathname === "/docs"
              ? "bg-accent/15 text-navy dark:text-accent-light"
              : "text-ink-muted hover:bg-accent/10 hover:text-ink",
            CHROME_LINK
          )}
        >
          Overview
        </Link>
      </div>

      {sections.map(({ section, articles }) => (
        <div key={section}>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{section}</p>
          <ul className="space-y-0.5">
            {articles.map((article) => {
              const href = `/docs/${article.slug}`;
              const isActive = pathname === href;

              return (
                <li key={article.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-accent/15 font-medium text-navy dark:text-accent-light"
                        : "text-ink-muted hover:bg-accent/10 hover:text-ink",
                      CHROME_LINK
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {article.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
