import Link from "next/link";
import { getDocSections } from "@/lib/docs";
import { CHROME_LINK } from "@/lib/chrome-interactive";
import { cn } from "@/components/ui/cn";
import { PRODUCT } from "@/lib/product";

export default function DocsIndexPage() {
  const sections = getDocSections();

  return (
    <div>
      <header className="mb-10 border-b border-border pb-8">
        <h1 className="font-serif text-4xl font-semibold text-navy mb-3">Documentation</h1>
        <p className="text-lg text-ink-muted max-w-2xl">
          Guides for using {PRODUCT.name} — integrations, settings, and workflows.
        </p>
      </header>

      <div className="space-y-10">
        {sections.map(({ section, articles }) => (
          <section key={section}>
            <h2 className="font-serif text-xl font-semibold text-navy mb-4">{section}</h2>
            <ul className="space-y-3">
              {articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={`/docs/${article.slug}`}
                    className={cn(
                      "block rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40 hover:bg-accent/5",
                      CHROME_LINK
                    )}
                  >
                    <span className="font-medium text-ink">{article.title}</span>
                    {article.description ? (
                      <p className="mt-1 text-sm text-ink-muted">{article.description}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
