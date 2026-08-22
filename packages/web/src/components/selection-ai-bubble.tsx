"use client";

import { useCallback, useEffect, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { Sparkles } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { AiPendingRequest } from "@/components/ai-sidebar";

export type SelectionAiAction =
  | "rephrase"
  | "improve"
  | "shorten"
  | "expand"
  | "citation"
  | "find-papers";

const ACTIONS: { action: SelectionAiAction; label: string }[] = [
  { action: "rephrase", label: "Rephrase" },
  { action: "improve", label: "Improve" },
  { action: "shorten", label: "Shorten" },
  { action: "expand", label: "Expand" },
  { action: "citation", label: "Cite" },
  { action: "find-papers", label: "Find papers" },
];

const ACTION_MESSAGES: Record<SelectionAiAction, string> = {
  rephrase: "Rephrase the selected text",
  improve: "Improve the selected text",
  shorten: "Shorten the selected text",
  expand: "Expand the selected text",
  citation: "Add a citation for the selected text",
  "find-papers": "Find papers related to the selected text",
};

interface SelectionAiBubbleProps {
  editorView: EditorView | null;
  onAction: (request: AiPendingRequest) => void;
  className?: string;
}

interface BubblePosition {
  top: number;
  left: number;
}

function getSelectionText(view: EditorView): string {
  const { from, to } = view.state.selection.main;
  if (from === to) return "";
  return view.state.sliceDoc(from, to).trim();
}

function getBubblePosition(view: EditorView): BubblePosition | null {
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

export function SelectionAiBubble({ editorView, onAction, className }: SelectionAiBubbleProps) {
  const [selectedText, setSelectedText] = useState("");
  const [position, setPosition] = useState<BubblePosition | null>(null);

  const syncFromEditor = useCallback(() => {
    if (!editorView) {
      setSelectedText("");
      setPosition(null);
      return;
    }

    const text = getSelectionText(editorView);
    if (!text) {
      setSelectedText("");
      setPosition(null);
      return;
    }

    setSelectedText(text);
    setPosition(getBubblePosition(editorView));
  }, [editorView]);

  useEffect(() => {
    if (!editorView) return;

    syncFromEditor();

    const onSelectionChange = () => syncFromEditor();
    const onScroll = () => syncFromEditor();
    const onResize = () => syncFromEditor();

    editorView.dom.addEventListener("mouseup", onSelectionChange);
    editorView.dom.addEventListener("keyup", onSelectionChange);
    editorView.scrollDOM.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      editorView.dom.removeEventListener("mouseup", onSelectionChange);
      editorView.dom.removeEventListener("keyup", onSelectionChange);
      editorView.scrollDOM.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [editorView, syncFromEditor]);

  useEffect(() => {
    if (!selectedText) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-selection-ai-bubble]")) return;
      setSelectedText("");
      setPosition(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedText("");
        setPosition(null);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedText]);

  if (!selectedText || !position) return null;

  return (
    <div
      data-selection-ai-bubble
      role="toolbar"
      aria-label="AI actions for selection"
      className={cn(
        "fixed z-50 flex max-w-[min(100vw-1rem,28rem)] flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-border bg-paper/95 px-1 py-1 shadow-lg backdrop-blur-sm sm:max-w-none sm:flex-nowrap sm:rounded-full",
        className
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className="hidden sm:inline-flex items-center gap-1 pl-2 pr-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        <Sparkles className="h-3 w-3 text-accent" aria-hidden />
        AI
      </span>
      {ACTIONS.map(({ action, label }) => (
        <button
          key={action}
          type="button"
          className="rounded-full px-2.5 py-1.5 text-[11px] font-medium text-ink hover:bg-canvas-dark transition-colors whitespace-nowrap sm:py-1"
          onClick={() => {
            onAction({
              message: ACTION_MESSAGES[action],
              action,
            });
            setSelectedText("");
            setPosition(null);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
