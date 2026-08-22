"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, bracketMatching, StreamLanguage } from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { tags as t } from "@lezer/highlight";
import { HighlightStyle } from "@codemirror/language";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { yCollab } from "y-codemirror.next";
import { useTheme } from "@/components/theme-provider";
import { latexCompletionSource } from "@/lib/latex-completion";
import { countDocumentStats, type DocumentStats } from "@/lib/document-stats";
import { colorForUserId, parseCollabToken } from "@/lib/project-sharing";
import { readStoredSpellcheckEnabled } from "@/lib/editor-preferences";
import { spellcheckCompartment, spellcheckExtensions } from "@/lib/latex-spellcheck";

const latexHighlightLight = HighlightStyle.define([
  { tag: t.keyword, color: "#2d6a6a" },
  { tag: t.comment, color: "#8a8278", fontStyle: "italic" },
  { tag: t.string, color: "#6b2d3a" },
  { tag: t.bracket, color: "#4a4540" },
]);

const latexHighlightDark = HighlightStyle.define([
  { tag: t.keyword, color: "#4f9a9a" },
  { tag: t.comment, color: "#78716c", fontStyle: "italic" },
  { tag: t.string, color: "#c46b7a" },
  { tag: t.bracket, color: "#d6d3d1" },
]);

const latexLang = StreamLanguage.define({
  token(stream) {
    if (stream.match(/^\\[a-zA-Z@]+/)) return "keyword";
    if (stream.match(/^%.*$/)) return "comment";
    if (stream.match(/^[{}[\]$&%#_^~\\]/)) return "bracket";
    if (stream.match(/^\$/)) return "string";
    stream.next();
    return null;
  },
});

interface LatexEditorProps {
  filePath: string;
  projectId: string;
  initialContent: string;
  collabToken: string | null;
  collabBaseUrl: string;
  canEdit: boolean;
  onChange: (content: string) => void;
  onEditorReady?: (view: EditorView) => void;
  onStatsChange?: (stats: DocumentStats) => void;
  jumpToLine?: number | null;
}

export function LatexEditor({
  filePath,
  projectId,
  initialContent,
  collabToken,
  collabBaseUrl,
  canEdit,
  onChange,
  onEditorReady,
  onStatsChange,
  jumpToLine,
}: LatexEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { isDark } = useTheme();

  const saveContent = useCallback(
    (content: string) => onChange(content),
    [onChange]
  );

  const reportStats = useCallback(
    (content: string) => onStatsChange?.(countDocumentStats(content)),
    [onStatsChange]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText(filePath);

    let provider: WebsocketProvider | null = null;
    if (collabToken) {
      provider = new WebsocketProvider(collabBaseUrl, projectId, ydoc, {
        params: { token: collabToken },
      });
      const payload = parseCollabToken(collabToken);
      if (payload) {
        provider.awareness.setLocalStateField("user", {
          userId: payload.userId,
          name: payload.userName,
          color: colorForUserId(payload.userId),
        });
      }
      provider.on("sync", () => {
        if (ytext.length === 0 && initialContent) {
          ytext.insert(0, initialContent);
        }
      });
    } else if (initialContent) {
      ytext.insert(0, initialContent);
    }

    const highlightStyle = isDark ? latexHighlightDark : latexHighlightLight;
    const initialDoc = ytext.toString() || initialContent;

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      bracketMatching(),
      latexLang,
      syntaxHighlighting(highlightStyle),
      search({ top: true }),
      autocompletion({
        override: [latexCompletionSource],
        activateOnTyping: true,
        maxRenderedOptions: 24,
      }),
      keymap.of([...completionKeymap, ...searchKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.editable.of(canEdit),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const content = update.state.doc.toString();
          saveContent(content);
          reportStats(content);
        }
      }),
      EditorView.theme({
        "&": {
          height: "100%",
          width: "100%",
          backgroundColor: "var(--color-paper)",
          color: "var(--color-ink)",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: "15px",
          lineHeight: "1.65",
        },
        ".cm-gutters": {
          backgroundColor: "var(--color-paper)",
          borderRight: "1px solid var(--color-border-light)",
          color: "var(--color-ink-faint)",
        },
        ".cm-activeLineGutter": { backgroundColor: "rgba(61, 133, 133, 0.12)" },
        ".cm-activeLine": { backgroundColor: "rgba(61, 133, 133, 0.08)" },
        ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 8px" },
        ".cm-content": { padding: "12px 16px 24px 8px" },
        ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
          backgroundColor: "rgba(61, 133, 133, 0.22) !important",
        },
        ".cm-cursor": { borderLeftColor: "var(--color-accent)" },
        ".cm-panels": {
          backgroundColor: "var(--color-paper)",
          color: "var(--color-ink)",
          borderBottom: "1px solid var(--color-border-light)",
        },
        ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--color-border-light)" },
        ".cm-searchMatch": { backgroundColor: "rgba(45, 106, 106, 0.25)" },
        ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgba(45, 106, 106, 0.45)" },
        ".cm-textfield, .cm-button": {
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          backgroundColor: "var(--color-paper)",
          color: "var(--color-ink)",
          border: "1px solid var(--color-border)",
          borderRadius: "4px",
        },
        ".cm-button": {
          backgroundColor: "var(--color-canvas)",
          cursor: "pointer",
        },
        ".cm-lintRange-warning": {
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3 L2 0 L4 3 L6 0' fill='none' stroke='%23b45309' stroke-width='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat-x",
          backgroundPosition: "left bottom",
        },
      }),
      spellcheckCompartment.of(spellcheckExtensions(readStoredSpellcheckEnabled())),
    ];

    if (provider) {
      extensions.push(yCollab(ytext, provider.awareness));
    }

    const state = EditorState.create({
      doc: initialDoc,
      extensions,
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    onEditorReady?.(view);
    reportStats(initialDoc);

    return () => {
      view.destroy();
      provider?.destroy();
      ydoc.destroy();
    };
  }, [filePath, projectId, collabToken, collabBaseUrl, canEdit, isDark]);

  useEffect(() => {
    if (jumpToLine && viewRef.current && jumpToLine > 0) {
      const doc = viewRef.current.state.doc;
      const lineNum = Math.min(jumpToLine, doc.lines);
      const line = doc.line(lineNum);
      viewRef.current.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
      viewRef.current.focus();
    }
  }, [jumpToLine]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}
