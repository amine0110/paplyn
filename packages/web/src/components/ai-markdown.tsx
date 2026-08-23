"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

interface AiMarkdownProps {
  content: string;
  className?: string;
}

function CodeBlock({ className, children, ...props }: React.ComponentProps<"code">) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match?.[1];
  const code = String(children).replace(/\n$/, "");
  const isBlock = className?.includes("language-") || code.includes("\n");

  if (!isBlock) {
    return (
      <code className="rounded bg-canvas-dark px-1 py-0.5 font-mono text-[0.85em]" {...props}>
        {children}
      </code>
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <div className="group relative my-1.5 overflow-hidden rounded-lg border border-border/80 bg-canvas-dark/20">
      <div className="flex items-center justify-between border-b border-border bg-canvas-dark/60 px-2 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
          {language || "code"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] opacity-70 group-hover:opacity-100"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-2.5 font-mono text-[11px] leading-snug">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function AiMarkdown({ content, className }: AiMarkdownProps) {
  return (
    <div className={cn("ai-markdown text-sm leading-snug", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-1.5 mt-2 font-serif text-base font-semibold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 mt-2 font-serif text-sm font-semibold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-1.5 text-sm font-semibold first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-1.5 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-1.5 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-accent/30 pl-2.5 text-ink-muted">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy underline underline-offset-2 hover:text-navy-light"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[16rem] border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-canvas-dark/70">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-border px-2 py-1.5 text-left font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-border px-2 py-1.5 align-top">{children}</td>,
          hr: () => <hr className="my-3 border-border" />,
          code: CodeBlock,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
