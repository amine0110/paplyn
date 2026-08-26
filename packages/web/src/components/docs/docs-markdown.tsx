"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/components/ui/cn";
import { CHROME_LINK } from "@/lib/chrome-interactive";

interface DocsMarkdownProps {
  content: string;
  className?: string;
}

export function DocsMarkdown({ content, className }: DocsMarkdownProps) {
  return (
    <div className={cn("docs-markdown max-w-none text-[15px] leading-relaxed text-ink", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-8 font-serif text-2xl font-semibold text-navy first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-8 font-serif text-xl font-semibold text-navy first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-6 text-base font-semibold first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 list-disc space-y-2 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-3 pl-5 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-accent/40 pl-4 text-ink-muted">{children}</blockquote>
          ),
          a: ({ href, children }) => {
            const isInternal = href?.startsWith("/");
            if (isInternal) {
              return (
                <Link href={href!} className={cn("text-accent underline underline-offset-2 hover:text-accent-light", CHROME_LINK)}>
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("text-accent underline underline-offset-2 hover:text-accent-light", CHROME_LINK)}
              >
                {children}
              </a>
            );
          },
          code: ({ className: codeClassName, children }) => {
            const isBlock = codeClassName?.includes("language-");
            if (isBlock) {
              return (
                <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-canvas-dark/40 p-4 font-mono text-sm">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-canvas-dark px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
