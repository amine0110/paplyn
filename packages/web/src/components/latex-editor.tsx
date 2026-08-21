"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, StreamLanguage } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";
import { HighlightStyle } from "@codemirror/language";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { yCollab } from "y-codemirror.next";

const latexHighlight = HighlightStyle.define([
  { tag: t.keyword, color: "#1e3a5f" },
  { tag: t.comment, color: "#8a8a9e", fontStyle: "italic" },
  { tag: t.string, color: "#c45c26" },
  { tag: t.bracket, color: "#4a4a5e" },
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
  jumpToLine,
}: LatexEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const saveContent = useCallback(
    (content: string) => onChange(content),
    [onChange]
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
      provider.on("sync", () => {
        if (ytext.length === 0 && initialContent) {
          ytext.insert(0, initialContent);
        }
      });
    } else if (initialContent) {
      ytext.insert(0, initialContent);
    }

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      bracketMatching(),
      latexLang,
      syntaxHighlighting(latexHighlight),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.lineWrapping,
      EditorView.editable.of(canEdit),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          saveContent(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": { height: "100%", backgroundColor: "#ffffff" },
        ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-mono)" },
        ".cm-gutters": { backgroundColor: "#faf9f7", borderRight: "1px solid #e8e6e1" },
      }),
    ];

    if (provider) {
      extensions.push(yCollab(ytext, provider.awareness));
    }

    const state = EditorState.create({
      doc: ytext.toString() || initialContent,
      extensions,
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    onEditorReady?.(view);

    return () => {
      view.destroy();
      provider?.destroy();
      ydoc.destroy();
    };
  }, [filePath, projectId, collabToken, collabBaseUrl, canEdit]);

  useEffect(() => {
    if (jumpToLine && viewRef.current && jumpToLine > 0) {
      const doc = viewRef.current.state.doc;
      const lineNum = Math.min(jumpToLine, doc.lines);
      const line = doc.line(lineNum);
      viewRef.current.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      });
    }
  }, [jumpToLine]);

  return <div ref={containerRef} className="h-full overflow-hidden" />;
}
