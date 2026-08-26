import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { CHROME_LINK } from "@/lib/chrome-interactive";
import type { DocArticleMeta } from "@/lib/docs/types";

interface DocsArticleNavProps {
  prev?: DocArticleMeta;
  next?: DocArticleMeta;
}

export function DocsArticleNav({ prev, next }: DocsArticleNavProps) {
  if (!prev && !next) return null;

  return (
    <nav
      className="mt-12 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:justify-between"
      aria-label="Article navigation"
    >
      {prev ? (
        <Link
          href={`/docs/${prev.slug}`}
          className={cn(
            "group flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm transition-colors hover:border-accent/40 hover:bg-accent/5",
            CHROME_LINK
          )}
        >
          <ChevronLeft className="h-4 w-4 shrink-0 text-ink-faint group-hover:text-accent" />
          <span>
            <span className="block text-xs text-ink-faint">Previous</span>
            <span className="font-medium text-ink">{prev.title}</span>
          </span>
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className={cn(
            "group flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm transition-colors hover:border-accent/40 hover:bg-accent/5 sm:ml-auto sm:text-right",
            CHROME_LINK
          )}
        >
          <span className="flex-1">
            <span className="block text-xs text-ink-faint">Next</span>
            <span className="font-medium text-ink">{next.title}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint group-hover:text-accent" />
        </Link>
      ) : null}
    </nav>
  );
}
