import type { LandingIntegration } from "@/lib/integrations/types";
import { IntegrationLogo } from "@/components/integration-logos";
import { cn } from "@/components/ui/cn";
import { integrationLogoKeyFromId } from "@/lib/integrations/logo-keys";

interface IntegrationsStripProps {
  items: LandingIntegration[];
}

function IntegrationStripItem({
  item,
  className,
}: {
  item: LandingIntegration;
  className?: string;
}) {
  const logoKey = integrationLogoKeyFromId(item.id);
  const content = (
    <div
      className={cn(
        "flex w-[7.5rem] shrink-0 flex-col items-center px-4 text-center sm:w-[8rem]",
        className
      )}
    >
      <div className="flex h-9 items-center justify-center">
        <IntegrationLogo logoKey={logoKey} />
      </div>
      {item.caption ? (
        <span className="mt-1.5 text-[10px] leading-snug text-ink-faint">{item.caption}</span>
      ) : null}
    </div>
  );

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={item.name}
        className="rounded-sm text-ink transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30"
      >
        {content}
      </a>
    );
  }

  return (
    <div aria-label={item.name} className="text-ink">
      {content}
    </div>
  );
}

export function IntegrationsStrip({ items }: IntegrationsStripProps) {
  if (items.length === 0) return null;

  const marqueeItems = [...items, ...items];

  return (
    <section aria-label="Works with" className="overflow-x-hidden border-y border-border bg-paper py-10 md:py-12">
      <div className="mx-auto max-w-5xl px-4">
        <p className="mb-6 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-ink-faint">
          Works with
        </p>

        <div className="integrations-marquee-viewport relative -mx-4 overflow-hidden sm:mx-0">
          <ul className="integrations-marquee-track flex items-start">
            {marqueeItems.map((item, index) => (
              <li key={`${item.id}-${index}`} className="list-none">
                <IntegrationStripItem item={item} />
              </li>
            ))}
          </ul>
        </div>

        <ul className="integrations-marquee-static hidden flex-wrap items-start justify-center gap-x-2 gap-y-5 sm:gap-x-4">
          {items.map((item) => (
            <li key={item.id} className="list-none">
              <IntegrationStripItem item={item} className="w-[6.5rem] sm:w-[7rem]" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
