"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { CHROME_CHIP, CHROME_SEND_BTN } from "@/lib/chrome-interactive";
import {
  initialInlineStatusForAction,
  runInlineSelectionAi,
  type InlineSelectionAiContext,
  type SelectionRange,
} from "@/lib/selection-ai-inline";

export type SelectionAiAction =
  | "rephrase"
  | "improve"
  | "shorten"
  | "expand"
  | "citation"
  | "find-papers"
  | "correct"
  | "write";

const ACTIONS: { action: SelectionAiAction; label: string }[] = [
  { action: "rephrase", label: "Rephrase" },
  { action: "improve", label: "Improve" },
  { action: "shorten", label: "Shorten" },
  { action: "expand", label: "Expand" },
  { action: "citation", label: "Cite" },
  { action: "correct", label: "Correct" },
  { action: "write", label: "Write" },
  { action: "find-papers", label: "Find papers" },
];

const ACTION_MESSAGES: Record<Exclude<SelectionAiAction, "write">, string> = {
  rephrase: "Rephrase the selected text",
  improve: "Improve the selected text",
  shorten: "Shorten the selected text",
  expand: "Expand the selected text",
  citation: "Add a citation for the selected text",
  correct: "Correct spelling and orthography in the selected text only. Do not rephrase.",
  "find-papers": "Find papers related to the selected text",
};

type BubbleStatus = "idle" | "thinking" | "done" | "error";

interface SelectionAiBubbleProps {
  editorView: EditorView | null;
  projectId: string;
  activeFile: string | null;
  inlineContext: InlineSelectionAiContext;
  className?: string;
}

interface BubblePosition {
  top: number;
  left: number;
}

function getSelectionSnapshot(view: EditorView): {
  text: string;
  range: SelectionRange;
} | null {
  const { from, to } = view.state.selection.main;
  if (from === to) return null;
  const text = view.state.sliceDoc(from, to).trim();
  if (!text) return null;
  return { text, range: { from, to } };
}

export function getBubblePosition(view: EditorView): BubblePosition | null {
  const { from, to } = view.state.selection.main;
  if (from === to) return null;

  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);
  if (!start || !end) return null;

  const top = Math.min(start.top, end.top);
  const left = (start.left + end.right) / 2;

  const bubbleHeight = 40;
  const margin = 8;
  const mobileTabReserve = 56 + 12;
  const maxTop = window.innerHeight - mobileTabReserve - bubbleHeight - margin;

  return {
    top: Math.max(margin, Math.min(top - bubbleHeight - margin, maxTop)),
    left: Math.max(72, Math.min(left, window.innerWidth - 72)),
  };
}

export function SelectionAiBubble({
  editorView,
  projectId,
  activeFile,
  inlineContext,
  className,
}: SelectionAiBubbleProps) {
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [position, setPosition] = useState<BubblePosition | null>(null);
  const [status, setStatus] = useState<BubbleStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [showWriteField, setShowWriteField] = useState(false);
  const [writePrompt, setWritePrompt] = useState("");
  const writeInputRef = useRef<HTMLInputElement>(null);
  const statusResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const clearStatusTimer = () => {
    if (statusResetRef.current) {
      clearTimeout(statusResetRef.current);
      statusResetRef.current = null;
    }
  };

  const dismissBubble = useCallback(() => {
    clearStatusTimer();
    setSelectedText("");
    setSelectionRange(null);
    setPosition(null);
    setStatus("idle");
    setStatusMessage("");
    setShowWriteField(false);
    setWritePrompt("");
  }, []);

  const syncFromEditor = useCallback(() => {
    if (!editorView) {
      dismissBubble();
      return;
    }

    if (status === "thinking") return;

    const snapshot = getSelectionSnapshot(editorView);
    if (!snapshot) {
      if (status === "idle") dismissBubble();
      return;
    }

    setSelectedText(snapshot.text);
    setSelectionRange(snapshot.range);
    setPosition(getBubblePosition(editorView));
  }, [editorView, dismissBubble, status]);

  useEffect(() => {
    if (!editorView) return;

    syncFromEditor();

    const onSelectionChange = () => {
      requestAnimationFrame(syncFromEditor);
    };
    const onScroll = () => requestAnimationFrame(syncFromEditor);
    const onResize = () => syncFromEditor();

    editorView.dom.addEventListener("mouseup", onSelectionChange);
    editorView.dom.addEventListener("keyup", onSelectionChange);
    document.addEventListener("selectionchange", onSelectionChange);
    editorView.scrollDOM.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      editorView.dom.removeEventListener("mouseup", onSelectionChange);
      editorView.dom.removeEventListener("keyup", onSelectionChange);
      document.removeEventListener("selectionchange", onSelectionChange);
      editorView.scrollDOM.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [editorView, syncFromEditor]);

  useEffect(() => {
    if (!selectedText || status === "thinking") return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-selection-ai-bubble]")) return;
      dismissBubble();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismissBubble();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedText, status, dismissBubble]);

  useEffect(() => {
    if (showWriteField) {
      writeInputRef.current?.focus();
    }
  }, [showWriteField]);

  const runAction = useCallback(
    async (message: string, action?: SelectionAiAction) => {
      if (!selectionRange || !selectedText) return;

      const requestId = ++requestIdRef.current;
      clearStatusTimer();
      setShowWriteField(false);
      setWritePrompt("");
      setStatus("thinking");
      setStatusMessage(initialInlineStatusForAction(action, message));

      const result = await runInlineSelectionAi(
        {
          projectId,
          activeFile,
          message,
          action,
          selectedText,
          selectionRange,
        },
        inlineContext,
        (progress) => {
          if (requestIdRef.current === requestId) {
            setStatusMessage(progress.replace(/…$/, ""));
          }
        }
      );

      if (requestIdRef.current !== requestId) return;

      if (result.ok) {
        setStatus("done");
        setStatusMessage(result.statusMessage);
        statusResetRef.current = setTimeout(() => dismissBubble(), 1400);
      } else {
        setStatus("error");
        setStatusMessage(result.error ?? "Error");
        statusResetRef.current = setTimeout(() => {
          setStatus("idle");
          setStatusMessage("");
        }, 3000);
      }
    },
    [
      activeFile,
      dismissBubble,
      inlineContext,
      projectId,
      selectedText,
      selectionRange,
    ]
  );

  const handleActionClick = (action: SelectionAiAction) => {
    if (action === "write") {
      setShowWriteField(true);
      return;
    }
    void runAction(ACTION_MESSAGES[action], action);
  };

  const handleWriteSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const prompt = writePrompt.trim();
    if (!prompt) return;
    void runAction(prompt, "write");
  };

  if (!selectedText || !position) return null;

  const isThinking = status === "thinking";
  const showStatus = status === "thinking" || status === "done" || status === "error";

  return (
    <div
      data-selection-ai-bubble
      role="toolbar"
      aria-label="AI actions for selection"
      className={cn(
        "fixed z-[60] flex max-w-[min(100vw-1rem,32rem)] flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-border bg-paper/95 px-1 py-1 shadow-lg backdrop-blur-sm sm:max-w-none sm:flex-nowrap sm:rounded-full",
        className
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {showStatus ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-ink-muted whitespace-nowrap">
          {isThinking ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" aria-hidden />
          ) : status === "done" ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          )}
          <span className={cn(status === "error" && "text-red-700 dark:text-red-300")}>
            {statusMessage}
          </span>
        </div>
      ) : showWriteField ? (
        <form
          className="flex items-center gap-1 px-1 py-0.5 min-w-[min(100vw-2rem,20rem)]"
          onSubmit={handleWriteSubmit}
        >
          <input
            ref={writeInputRef}
            type="text"
            value={writePrompt}
            onChange={(event) => setWritePrompt(event.target.value)}
            placeholder="What should we do with this selection?"
            className="min-w-0 flex-1 rounded-full border border-border bg-canvas-dark/40 px-3 py-1.5 text-[11px] text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setShowWriteField(false);
                setWritePrompt("");
              }
            }}
          />
          <button
            type="submit"
            className={cn(CHROME_SEND_BTN, "h-7 w-7 shrink-0 rounded-full")}
            disabled={!writePrompt.trim()}
            aria-label="Apply write instruction"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : (
        <>
          <span className="hidden sm:inline-flex items-center gap-1 pl-2 pr-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
            <Sparkles className="h-3 w-3 text-accent" aria-hidden />
            AI
          </span>
          {ACTIONS.map(({ action, label }) => (
            <button
              key={action}
              type="button"
              className={cn(
                CHROME_CHIP,
                "px-2.5 py-1.5 text-[11px] whitespace-nowrap sm:py-1"
              )}
              onClick={() => handleActionClick(action)}
            >
              {label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
