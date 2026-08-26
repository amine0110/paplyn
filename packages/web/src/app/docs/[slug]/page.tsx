import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticleNav } from "@/components/docs/docs-article-nav";
import { DocsMarkdown } from "@/components/docs/docs-markdown";
import { getAdjacentDocs, getAllDocSlugs, getDocBySlug } from "@/lib/docs";
import { PRODUCT } from "@/lib/product";

type DocPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) {
    return { title: `Documentation — ${PRODUCT.name}` };
  }

  return {
    title: `${doc.title} — ${PRODUCT.name} Docs`,
    description: doc.description || undefined,
  };
}

export default async function DocArticlePage({ params }: DocPageProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) {
    notFound();
  }

  const { prev, next } = getAdjacentDocs(slug);

  return (
    <article>
      <header className="mb-8 border-b border-border pb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{doc.section}</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-navy mb-3">{doc.title}</h1>
        {doc.description ? <p className="text-lg text-ink-muted">{doc.description}</p> : null}
      </header>
      <DocsMarkdown content={doc.content} />
      <DocsArticleNav prev={prev} next={next} />
    </article>
  );
}
