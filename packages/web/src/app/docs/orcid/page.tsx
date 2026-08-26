import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Nav } from "@/components/nav";

const DOC_PATH = join(process.cwd(), "content/docs/orcid.md");

export default function OrcidDocsPage() {
  const markdown = readFileSync(DOC_PATH, "utf8");

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-10 prose prose-neutral dark:prose-invert">
        <p className="not-prose text-sm text-ink-muted mb-6">
          <Link href="/settings" className="text-navy hover:underline">
            ← Back to Settings
          </Link>
        </p>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </main>
    </div>
  );
}
