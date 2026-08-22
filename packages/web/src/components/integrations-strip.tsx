import type { LandingIntegration } from "@/lib/integrations/types";
import { cn } from "@/components/ui/cn";

interface IntegrationsStripProps {
  items: LandingIntegration[];
}

export function IntegrationsStrip({ items }: IntegrationsStripProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Works with" className="border-y border-border bg-paper py-10 md:py-12">
      <div className="mx-auto max-w-5xl px-4">
        <p className="mb-6 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-ink-faint">
          Works with
        </p>
        <ul className="flex flex-wrap items-start justify-center gap-x-6 gap-y-5 sm:gap-x-10">
          {items.map((item) => {
            const wordmark = (
              <span className={cn("text-base leading-none sm:text-lg", item.wordmarkClassName)}>
                {item.wordmark}
              </span>
            );

            return (
              <li key={item.id} className="flex min-w-[7rem] max-w-[11rem] flex-col items-center text-center">
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-sm text-ink transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
                  >
                    {wordmark}
                  </a>
                ) : (
                  wordmark
                )}
                {item.caption ? (
                  <span className="mt-1.5 text-[10px] leading-snug text-ink-faint">{item.caption}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
