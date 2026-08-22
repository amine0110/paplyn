"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, X } from "lucide-react";
import { aiUnavailableBannerMessage, isClientSelfHosted } from "@/lib/ai-config";
import { extractInsertableContent } from "@/lib/ai-insert-content";
import { AiMarkdown } from "@/components/ai-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiSidebarProps {
  projectId: string;
  activeFile: string | null;
  selectedText: string;
  compileErrors: string[];
  onInsert: (text: string) => void;
  onClose: () => void;
  /** Full-pane sheet on mobile; sidebar panel on desktop. */
  variant?: "sidebar" | "sheet";
}

export function AiSidebar({
  projectId,
  activeFile,
  selectedText,
  compileErrors,
  onInsert,
  onClose,
  variant = "sidebar",
}: AiSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(content: string, action?: string) {
    if (!content.trim() && !action) return;
    setLoading(true);

    const userMsg: Message = { role: "user", content: content || action || "" };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await fetch(`/api/projects/${projectId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
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
      setMessages((prev) => [...prev, { role: "assistant", content: data.content || "" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Failed to connect to AI service." }]);
    } finally {
      setLoading(false);
    }
  }

  const quickActions = [
    { label: "Explain errors", action: "explain-errors", disabled: compileErrors.length === 0 },
    { label: "Tighten selection", action: "tighten", disabled: !selectedText },
    { label: "Add citation", action: "citation", disabled: false },
    { label: "Find papers", action: "find-papers", disabled: false },
  ];

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
              {msg.role === "user" ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
              ) : (
                <AiMarkdown content={msg.content} />
              )}
              {msg.role === "assistant" && msg.content && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 px-2 text-[11px] text-ink-muted hover:text-ink"
                  onClick={() => onInsert(extractInsertableContent(msg.content))}
                >
                  Insert at cursor
                </Button>
              )}
            </div>
          ))}
          {loading && (
            <div className="mr-auto max-w-[95%] rounded-xl border border-border bg-paper px-3 py-2.5 text-sm text-ink-muted">
              Thinking…
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
