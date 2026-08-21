"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDownToLine, Search } from "lucide-react";

interface EditorToolbarProps {
  editorView: EditorView | null;
  onGoToLine: (line: number) => void;
}

export function EditorToolbar({ editorView, onGoToLine }: EditorToolbarProps) {
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [lineInput, setLineInput] = useState("");
  const goToInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editorView) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
        const active = editorView.dom.getRootNode() instanceof Document
          ? (editorView.dom.getRootNode() as Document).activeElement
          : null;
        if (active && editorView.dom.contains(active)) {
          event.preventDefault();
          setShowGoToLine(true);
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editorView]);

  useEffect(() => {
    if (showGoToLine) {
      goToInputRef.current?.focus();
      goToInputRef.current?.select();
    }
  }, [showGoToLine]);

  function openSearch() {
    if (!editorView) return;
    editorView.focus();
    openSearchPanel(editorView);
  }

  function submitGoToLine(e: React.FormEvent) {
    e.preventDefault();
    const line = Number.parseInt(lineInput, 10);
    if (!Number.isFinite(line) || line < 1) return;
    onGoToLine(line);
    setShowGoToLine(false);
    setLineInput("");
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border-light bg-paper shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={openSearch}
        disabled={!editorView}
        title="Find and replace (Ctrl+F)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Find</span>
      </Button>
      <Button
        type="button"
        variant={showGoToLine ? "secondary" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setShowGoToLine((open) => !open)}
        disabled={!editorView}
        title="Go to line (Ctrl+G)"
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Go to line</span>
      </Button>

      {showGoToLine && (
        <form onSubmit={submitGoToLine} className="flex items-center gap-1.5 ml-1">
          <Input
            ref={goToInputRef}
            type="number"
            min={1}
            value={lineInput}
            onChange={(e) => setLineInput(e.target.value)}
            placeholder="Line #"
            className="h-7 w-20 text-xs font-mono"
            aria-label="Line number"
          />
          <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={!lineInput}>
            Go
          </Button>
        </form>
      )}

      <span className="ml-auto hidden md:inline text-[11px] text-ink-faint font-mono">
        Ctrl+F search · Ctrl+G line
      </span>
    </div>
  );
}

interface EditorStatusBarProps {
  filePath: string | null;
  wordCount: number;
  characterCount: number;
}

export function EditorStatusBar({ filePath, wordCount, characterCount }: EditorStatusBarProps) {
  if (!filePath) return null;

  return (
    <div className="flex items-center justify-end px-3 py-1 border-t border-border-light bg-paper text-[11px] text-ink-faint font-mono shrink-0 tabular-nums">
      {wordCount.toLocaleString()} words · {characterCount.toLocaleString()} characters
    </div>
  );
}
