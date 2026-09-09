import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "@/lib/docs/parse-frontmatter";
import type { DocArticle, DocArticleMeta, DocSection } from "@/lib/docs/types";

const DOCS_DIR = join(process.cwd(), "content/docs");

const SECTION_ORDER: Record<string, number> = {
  "Get started": 0,
  "Self-hosting": 1,
  Integrations: 2,
};

function sectionOrder(section: string): number {
  return SECTION_ORDER[section] ?? 100;
}

function readDocFile(filename: string): DocArticle | null {
  const filePath = join(DOCS_DIR, filename);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const slugFromFile = filename.replace(/\.md$/, "");

  const slug = String(meta.slug ?? slugFromFile);
  const title = String(meta.title ?? slug);
  const description = String(meta.description ?? "");
  const section = String(meta.section ?? "Guides");
  const order = typeof meta.order === "number" ? meta.order : 0;

  return { slug, title, description, section, order, content: body };
}

export function getAllDocs(): DocArticle[] {
  if (!existsSync(DOCS_DIR)) return [];

  return readdirSync(DOCS_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => readDocFile(name))
    .filter((doc): doc is DocArticle => doc !== null)
    .sort((a, b) => {
      const sectionDiff = sectionOrder(a.section) - sectionOrder(b.section);
      if (sectionDiff !== 0) return sectionDiff;
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title);
    });
}

export function getDocBySlug(slug: string): DocArticle | null {
  const direct = readDocFile(`${slug}.md`);
  if (direct) return direct;

  return getAllDocs().find((doc) => doc.slug === slug) ?? null;
}

export function getDocSections(): DocSection[] {
  const sections = new Map<string, DocArticleMeta[]>();

  for (const doc of getAllDocs()) {
    const { content: _content, ...meta } = doc;
    const list = sections.get(meta.section) ?? [];
    list.push(meta);
    sections.set(meta.section, list);
  }

  return [...sections.entries()]
    .map(([section, articles]) => ({
      section,
      order: sectionOrder(section),
      articles: articles.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.order - b.order || a.section.localeCompare(b.section));
}

export function getAdjacentDocs(slug: string): {
  prev?: DocArticleMeta;
  next?: DocArticleMeta;
} {
  const docs = getAllDocs().map(({ content: _content, ...meta }) => meta);
  const index = docs.findIndex((doc) => doc.slug === slug);
  if (index === -1) return {};

  return {
    prev: index > 0 ? docs[index - 1] : undefined,
    next: index < docs.length - 1 ? docs[index + 1] : undefined,
  };
}

export function getAllDocSlugs(): string[] {
  return getAllDocs().map((doc) => doc.slug);
}
