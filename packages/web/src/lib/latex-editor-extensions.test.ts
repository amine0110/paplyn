import { describe, it, expect, afterEach } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { historyKeymap } from "@codemirror/commands";
import type { KeyBinding } from "@codemirror/view";
import { buildCollabEditorSyncExtensions } from "@/lib/latex-editor-extensions";

function expectKeyBindings(bindings: readonly KeyBinding[]) {
  return bindings;
}

describe("buildCollabEditorSyncExtensions", () => {
  let ydoc: Y.Doc;

  afterEach(() => {
    ydoc?.destroy();
  });

  it("omits CodeMirror history when a collab provider is present", () => {
    ydoc = new Y.Doc();
    const ytext = ydoc.getText("main.tex");
    const awareness = new Awareness(ydoc);

    const collab = buildCollabEditorSyncExtensions(true, ytext, awareness);

    expect(collab.undoManager).not.toBeNull();
    expect(expectKeyBindings(collab.keymapExtensions)).toHaveLength(0);
    expect(collab.extensions).toHaveLength(1);

    collab.undoManager?.destroy();
    awareness.destroy();
  });

  it("uses CodeMirror history when collab is disabled", () => {
    ydoc = new Y.Doc();
    const ytext = ydoc.getText("main.tex");

    const offline = buildCollabEditorSyncExtensions(false, ytext, null);

    expect(offline.undoManager).toBeNull();
    expect(expectKeyBindings(offline.keymapExtensions)).toBe(historyKeymap);
    expect(offline.extensions).toHaveLength(1);
  });
});
