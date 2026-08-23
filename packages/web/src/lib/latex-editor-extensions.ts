import { history, historyKeymap } from "@codemirror/commands";
import type { Extension } from "@codemirror/state";
import * as Y from "yjs";
import { yCollab } from "y-codemirror.next";
import type { Awareness } from "y-protocols/awareness";

export type CollabEditorSyncExtensions = {
  extensions: Extension[];
  keymapExtensions: readonly Extension[];
  undoManager: Y.UndoManager | null;
};

/**
 * y-codemirror.next must not share CodeMirror's history() with yCollab — undo/typing
 * can stay local. Offline editors keep CM history; collab uses Y.UndoManager instead.
 */
export function buildCollabEditorSyncExtensions(
  collabEnabled: boolean,
  ytext: Y.Text,
  awareness: Awareness | null
): CollabEditorSyncExtensions {
  if (collabEnabled && awareness) {
    const undoManager = new Y.UndoManager(ytext);
    return {
      extensions: [yCollab(ytext, awareness, { undoManager })],
      keymapExtensions: [],
      undoManager,
    };
  }

  return {
    extensions: [history()],
    keymapExtensions: historyKeymap,
    undoManager: null,
  };
}
