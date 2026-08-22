"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, X } from "lucide-react";
import { aiUnavailableBannerMessage, isClientSelfHosted } from "@/lib/ai-config";
import { extractInsertableContent } from "@/lib/ai-insert-content";
import { AiMarkdown } from "@/components/ai-markdown";
import type { AiPaper, AiUsedPlugin } from "@/lib/ai-types";
import { loadingLabelForLiteratureAction } from "@/lib/ai-plugins/client-meta";

interface Message {
  role: "user" | "assistant";
  content: string;
  usedPlugins?: AiUsedPlugin[];
  papers?: AiPaper[];
}

export interface AiPendingRequest {
  message: string;
  action?: string;
}

interface AiSidebarProps {
  projectId: string;
  activeFile: string | null;
  selectedText: string;
  compileErrors: string[];
  onInsert: (text: string) => void;
  onReplace?: (text: string) => void;
  onCitePaper?: (paper: AiPaper) => void | Promise<void>;
  onClose: () => void;
  /** Full-pane sheet on mobile; sidebar panel on desktop. */
  variant?: "sidebar" | "sheet";
  /** Auto-send when opened from the selection bubble. */
  pendingRequest?: AiPendingRequest | null;
  onPendingRequestConsumed?: () => void;
}

function loadingMessageForAction(action?: string, userMessage?: string): string {
  return loadingLabelForLiteratureAction(action, userMessage) ?? "Thinking…";
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "Unknown authors";
  if (authors.length <= 2) return authors.join(", ");
  return `${authors.slice(0, 2).join(", ")} et al.`;
}

function PluginChip({ plugin }: { plugin: AiUsedPlugin }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-canvas-dark/70 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
      Used {plugin.displayName}
    </span>
  );
}

export function AiSidebar({
  projectId,
  activeFile,
  selectedText,
  compileErrors,
  onInsert,
  onReplace,
  onCitePaper,
  onClose,
  variant = "sidebar",
  pendingRequest,
  onPendingRequestConsumed,
}: AiSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Thinking…");
  const [available, setAvailable] = useState(true);
  const [citingKey, setCitingKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(content: string, action?: string) {
    if (!content.trim() && !action) return;
    setLoading(true);
    setLoadingMessage(loadingMessageForAction(action, content));

    const userMsg: Message = { role: "user", content: content || action || "" };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await fetch(`/api/projects/${projectId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messagesRef.current, userMsg],
          activeFile,
          selectedText: selectedText || undefined,
          action,
          compileErrors: action === "explain-errors" ? compileErrors : undefined,
        }),
      });

      if (res.status === 503) {
        setAvailable(false);
        const err = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: err.error || aiUnavailableBannerMessage(isClientSelfHosted()),
          },
        ]);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const fallback =
          res.status === 413 || res.status === 429
            ? "The prompt is too large for the AI service. Try a smaller selection or ask about one file."
            : "Request failed";
        const message =
          typeof err.error === "string"
            ? err.error
            : typeof err.error === "object" && err.error !== null
              ? JSON.stringify(err.error)
              : fallback;
        setMessages((prev) => [...prev, { role: "assistant", content: message }]);
        return;
      }

      const data = await res.json();
      const assistantContent = typeof data.content === "string" ? data.content.trim() : "";
      if (!assistantContent) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "The assistant returned an empty response. Please try again.",
          },
        ]);
        return;
      }

      const usedPlugins = Array.isArray(data.usedPlugins) ? (data.usedPlugins as AiUsedPlugin[]) : undefined;
      const papers = Array.isArray(data.papers) ? (data.papers as AiPaper[]) : undefined;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantContent,
          ...(usedPlugins?.length ? { usedPlugins } : {}),
          ...(papers?.length ? { papers } : {}),
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to connect to AI service." }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCite(paper: AiPaper) {
    if (!onCitePaper) return;
    const key = paper.doi ?? paper.title;
    setCitingKey(key);
    try {
      await onCitePaper(paper);
    } finally {
      setCitingKey(null);
    }
  }

  useEffect(() => {
    if (!pendingRequest) return;
    void sendMessage(pendingRequest.message, pendingRequest.action);
    onPendingRequestConsumed?.();
    // Only fire when a new pending request is supplied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest]);

  const quickActions = [
    { label: "Explain errors", action: "explain-errors", disabled: compileErrors.length === 0 },
    { label: "Tighten selection", action: "tighten", disabled: !selectedText },
    { label: "Add citation", action: "citation", disabled: false },
    { label: "Find papers", action: "find-papers", disabled: false },
  ];

  const canReplace = Boolean(selectedText && onReplace);

  return (
    <div
      className={`flex flex-col h-full min-h-0 bg-surface ${
        variant === "sidebar" ? "border-l border-border" : ""
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-navy" />
          AI Assistant
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!available && (
        <div className="shrink-0 border-b border-border bg-canvas-dark px-3 py-2 text-xs text-ink-muted">
          {aiUnavailableBannerMessage(isClientSelfHosted())}
        </div>
      )}

      {selectedText && (
        <div className="shrink-0 border-b border-border bg-canvas-dark/60 px-3 py-2 text-xs text-ink-muted">
          <span className="font-medium text-ink">Selection:</span>{" "}
          <span className="line-clamp-2">{selectedText}</span>
        </div>
      )}

      <div className="shrink-0 border-b border-border px-2 py-1.5">
        <div className="flex flex-wrap gap-1">
          {quickActions.map((a) => (
            <Button
              key={a.action}
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={a.disabled || loading}
              onClick={() => sendMessage(a.label, a.action)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-muted">
              Ask about your LaTeX project, get help with errors, or search for related papers.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[95%] rounded-xl px-3 py-2.5 ${
                msg.role === "user"
                  ? "ml-auto bg-navy text-white"
                  : "mr-auto border border-border bg-paper shadow-sm"
              }`}
            >
              {msg.role === "assistant" && msg.usedPlugins && msg.usedPlugins.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {msg.usedPlugins.map((plugin) => (
                    <PluginChip key={`${plugin.id}-${plugin.source ?? "default"}`} plugin={plugin} />
                  ))}
                </div>
              )}
              {msg.role === "user" ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
              ) : (
                <AiMarkdown content={msg.content} />
              )}
              {msg.role === "assistant" && msg.papers && msg.papers.length > 0 && onCitePaper && (
                <div className="mt-3 space-y-2 border-t border-border pt-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    Cite from search
                  </p>
                  {msg.papers.map((paper) => {
                    const citeId = paper.doi ?? paper.title;
                    const isCiting = citingKey === citeId;
                    return (
                      <div
                        key={citeId}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border/70 bg-canvas-dark/40 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-snug text-ink line-clamp-2">
                            {paper.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-ink-muted">
                            {formatAuthors(paper.authors)}
                            {paper.year != null ? ` · ${paper.year}` : ""}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-[11px]"
                          disabled={loading || isCiting}
                          onClick={() => void handleCite(paper)}
                        >
                          {isCiting ? "Citing…" : "Cite"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {msg.role === "assistant" && msg.content && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {canReplace && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-ink-muted hover:text-ink"
                      onClick={() => onReplace?.(extractInsertableContent(msg.content))}
                    >
                      Replace selection
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-ink-muted hover:text-ink"
                    onClick={() => onInsert(extractInsertableContent(msg.content))}
                  >
                    Insert at cursor
                  </Button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="mr-auto max-w-[95%] rounded-xl border border-border bg-paper px-3 py-2.5 text-sm text-ink-muted">
              {loadingMessage}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div
        className={`shrink-0 border-t border-border bg-surface p-3 ${
          variant === "sheet" ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : ""
        }`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your document…"
            disabled={loading}
            className="min-h-9 min-w-0 flex-1"
          />
          <Button type="submit" size="icon" className="shrink-0" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
