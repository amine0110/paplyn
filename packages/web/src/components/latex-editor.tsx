"use client";

import { useEffect, useRef, useCallback } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
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
import {
  getCollabEditorInitialDoc,
  getOfflineEditorInitialDoc,
  seedYTextIfEmpty,
} from "@/lib/collab-seed";
import { buildCollabEditorSyncExtensions } from "@/lib/latex-editor-extensions";
import {
  COLLAB_CONNECTION_LOST_MS,
  COLLAB_SAVE_MAX_WAIT_MS,
  createSaveStatusTracker,
  PERSIST_ACK_FIELD,
  PERSIST_META_MAP,
  type SaveStatus,
} from "@/lib/save-status";

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
  onSaveStatusChange?: (status: SaveStatus) => void;
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
  onSaveStatusChange,
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
    const collabEnabled = Boolean(collabToken);
    const saveStatusTracker = onSaveStatusChange
      ? createSaveStatusTracker(onSaveStatusChange, {
          ackTimeoutMs: collabEnabled ? COLLAB_SAVE_MAX_WAIT_MS : 0,
          initialStatus: collabEnabled ? "syncing" : "saved",
          isSynced: () => !collabEnabled || (provider?.synced ?? false),
          isConnected: () => !collabEnabled || (provider?.wsconnected ?? false),
          connectionLostGraceMs: COLLAB_CONNECTION_LOST_MS,
        })
      : null;

    const editableCompartment = new Compartment();
    let collabSynced = !collabEnabled;

    const enableEditingAfterSync = (view: EditorView) => {
      if (!collabSynced) {
        collabSynced = true;
        saveStatusTracker?.onSynced();
        view.dispatch({
          effects: editableCompartment.reconfigure(EditorView.editable.of(canEdit)),
        });
      }
    };

    if (collabToken) {
      provider = new WebsocketProvider(collabBaseUrl, projectId, ydoc, {
        params: { token: collabToken },
      });
      provider.on("status", (event: { status: string }) => {
        if (event.status === "disconnected") {
          saveStatusTracker?.onConnectionLost();
        } else if (event.status === "connected") {
          saveStatusTracker?.onConnectionRestored();
        }
      });
      provider.on("sync", (synced: boolean) => {
        if (synced && viewRef.current) {
          enableEditingAfterSync(viewRef.current);
        }
      });
      const payload = parseCollabToken(collabToken);
      if (payload) {
        provider.awareness.setLocalStateField("user", {
          userId: payload.userId,
          name: payload.userName,
          color: colorForUserId(payload.userId),
        });
      }
      // Rooms are seeded on the collab server from project_file; do not seed here.
    } else if (initialContent) {
      seedYTextIfEmpty(ytext, initialContent);
    }

    const disconnectCollab = () => {
      if (provider?.wsconnected) {
        provider.disconnect();
      }
    };

    let metaObserver: (() => void) | null = null;
    let metaMap: Y.Map<unknown> | null = null;

    if (saveStatusTracker && canEdit) {
      ydoc.on("update", (_update, origin) => {
        saveStatusTracker.onDocUpdate(origin, provider);
      });

      if (collabToken) {
        metaMap = ydoc.getMap(PERSIST_META_MAP);
        metaObserver = () => {
          if (metaMap?.get(PERSIST_ACK_FIELD) != null) {
            saveStatusTracker.markSaved();
          }
        };
        metaMap.observe(metaObserver);
      }
    }

    const onBeforeUnload = () => {
      disconnectCollab();
    };
    if (collabToken) {
      window.addEventListener("beforeunload", onBeforeUnload);
    }

    const highlightStyle = isDark ? latexHighlightDark : latexHighlightLight;
    const initialDoc = collabEnabled
      ? getCollabEditorInitialDoc(ytext.toString())
      : getOfflineEditorInitialDoc(ytext.toString(), initialContent);

    const { extensions: syncExtensions, keymapExtensions, undoManager } =
      buildCollabEditorSyncExtensions(collabEnabled, ytext, provider?.awareness ?? null);

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      ...syncExtensions,
      bracketMatching(),
      latexLang,
      syntaxHighlighting(highlightStyle),
      search({ top: true }),
      autocompletion({
        override: [latexCompletionSource],
        activateOnTyping: true,
        maxRenderedOptions: 24,
      }),
      keymap.of([...completionKeymap, ...searchKeymap, ...defaultKeymap, ...keymapExtensions, indentWithTab]),
      editableCompartment.of(EditorView.editable.of(canEdit && collabSynced)),
      EditorView.lineWrapping,
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

    const state = EditorState.create({
      doc: initialDoc,
      extensions,
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    if (collabEnabled && provider?.synced) {
      enableEditingAfterSync(view);
    }
    onEditorReady?.(view);
    reportStats(initialDoc);

    return () => {
      if (collabToken) {
        window.removeEventListener("beforeunload", onBeforeUnload);
        disconnectCollab();
      }
      if (metaMap && metaObserver) {
        metaMap.unobserve(metaObserver);
      }
      saveStatusTracker?.destroy();
      undoManager?.destroy();
      view.destroy();
      provider?.destroy();
      ydoc.destroy();
    };
  }, [filePath, projectId, collabToken, collabBaseUrl, canEdit, isDark, onSaveStatusChange]);

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
