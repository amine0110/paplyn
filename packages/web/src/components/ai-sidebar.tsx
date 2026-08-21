"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, X } from "lucide-react";

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
}

export function AiSidebar({
  projectId,
  activeFile,
  selectedText,
  compileErrors,
  onInsert,
  onClose,
}: AiSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "AI is not configured. Set OPENAI_API_KEY in your environment or admin settings." },
        ]);
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: err.error || "Request failed" }]);
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
  ];

  return (
    <div className="flex flex-col h-full border-l border-border bg-surface">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-navy" />
          AI Assistant
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!available && (
        <div className="px-3 py-2 bg-canvas-dark text-xs text-ink-muted border-b border-border">
          Configure OPENAI_API_KEY to enable AI features.
        </div>
      )}

      <div className="flex flex-wrap gap-1 p-2 border-b border-border">
        {quickActions.map((a) => (
          <Button
            key={a.action}
            variant="outline"
            size="sm"
            disabled={a.disabled || loading}
            onClick={() => sendMessage(a.label, a.action)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-8">
            Ask about your LaTeX project, get help with errors, or improve your writing.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm rounded-lg p-3 ${
              msg.role === "user" ? "bg-navy/5 ml-4" : "bg-canvas-dark mr-4"
            }`}
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
            {msg.role === "assistant" && msg.content && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => onInsert(msg.content)}
              >
                Insert at cursor
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border">
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
            placeholder="Ask about your document..."
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
