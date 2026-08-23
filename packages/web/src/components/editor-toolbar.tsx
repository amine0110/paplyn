"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  persistSpellcheckEnabled,
  readStoredSpellcheckEnabled,
} from "@/lib/editor-preferences";
import { setSpellcheckEnabled } from "@/lib/latex-spellcheck";
import { CHROME_TOOLBAR_BTN } from "@/lib/chrome-interactive";
import { cn } from "@/components/ui/cn";
import { ArrowDownToLine, Search, SpellCheck } from "lucide-react";
import { getSaveStatusLabel, type SaveStatus } from "@/lib/save-status";

interface EditorToolbarProps {
  editorView: EditorView | null;
  onGoToLine: (line: number) => void;
}

export function EditorToolbar({ editorView, onGoToLine }: EditorToolbarProps) {
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [lineInput, setLineInput] = useState("");
  const [spellcheckEnabled, setSpellcheckEnabledState] = useState(readStoredSpellcheckEnabled);
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

  function toggleSpellcheck() {
    if (!editorView) return;
    const next = !spellcheckEnabled;
    setSpellcheckEnabledState(next);
    persistSpellcheckEnabled(next);
    setSpellcheckEnabled(editorView, next);
    editorView.focus();
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 border-b border-border-light bg-paper shrink-0">
      <button
        type="button"
        className={cn(CHROME_TOOLBAR_BTN, "h-7")}
        onClick={openSearch}
        disabled={!editorView}
        title="Find and replace (Ctrl+F)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Find</span>
      </button>
      <button
        type="button"
        className={cn(
          CHROME_TOOLBAR_BTN,
          "h-7",
          showGoToLine && "bg-canvas-dark border border-border text-ink"
        )}
        onClick={() => setShowGoToLine((open) => !open)}
        disabled={!editorView}
        title="Go to line (Ctrl+G)"
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Go to line</span>
      </button>

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

      <button
        type="button"
        className={cn(
          CHROME_TOOLBAR_BTN,
          "h-7",
          spellcheckEnabled && "bg-canvas-dark border border-border text-ink"
        )}
        onClick={toggleSpellcheck}
        disabled={!editorView}
        title="Toggle spellcheck"
        aria-pressed={spellcheckEnabled}
      >
        <SpellCheck className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Spellcheck</span>
      </button>

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
  saveStatus?: SaveStatus;
  showSaveStatus?: boolean;
}

export function EditorStatusBar({
  filePath,
  wordCount,
  characterCount,
  saveStatus = "saved",
  showSaveStatus = false,
}: EditorStatusBarProps) {
  if (!filePath) return null;

  return (
    <div className="flex items-center justify-between px-3 py-1 border-t border-border-light bg-paper text-[11px] text-ink-faint font-mono shrink-0 tabular-nums">
      {showSaveStatus && (
        <span className={saveStatus === "saving" ? "text-ink-muted" : "text-ink-faint"}>
          {getSaveStatusLabel(saveStatus)}
        </span>
      )}
      <span className={showSaveStatus ? "" : "ml-auto"}>
        {wordCount.toLocaleString()} words · {characterCount.toLocaleString()} characters
      </span>
    </div>
  );
}
