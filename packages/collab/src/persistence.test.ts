import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  applyDocState,
  decodeStoredState,
  encodeDocState,
  encodeStoredState,
  filterSyncableTextFiles,
  getTextFilesFromDoc,
  isDocEmpty,
  isSyncableTextPath,
} from "./persistence.js";

describe("Yjs persistence helpers", () => {
  it("encodeDocState and applyDocState round-trip text content", () => {
    const source = new Y.Doc();
    source.getText("main.tex").insert(0, "\\documentclass{article}\nHello world");

    const restored = new Y.Doc();
    applyDocState(restored, encodeDocState(source));

    expect(restored.getText("main.tex").toString()).toBe(
      "\\documentclass{article}\nHello world"
    );
  });

  it("applyDocState merges incremental edits", () => {
    const base = new Y.Doc();
    base.getText("chapter.tex").insert(0, "Part one");

    const edited = new Y.Doc();
    applyDocState(edited, encodeDocState(base));
    edited.getText("chapter.tex").insert(8, " and two");

    const merged = new Y.Doc();
    applyDocState(merged, encodeDocState(base));
    applyDocState(merged, encodeDocState(edited));

    expect(merged.getText("chapter.tex").toString()).toBe("Part one and two");
  });

  it("encodeStoredState and decodeStoredState round-trip binary", () => {
    const doc = new Y.Doc();
    doc.getText("notes.tex").insert(0, "Persist me");
    const binary = encodeDocState(doc);
    const encoded = encodeStoredState(binary);
    const decoded = decodeStoredState(encoded);

    const restored = new Y.Doc();
    applyDocState(restored, decoded);
    expect(restored.getText("notes.tex").toString()).toBe("Persist me");
  });

  it("isDocEmpty detects empty and non-empty documents", () => {
    const empty = new Y.Doc();
    expect(isDocEmpty(empty)).toBe(true);

    const populated = new Y.Doc();
    populated.getText("main.tex").insert(0, "x");
    expect(isDocEmpty(populated)).toBe(false);
  });

  it("preserves multiple shared types in one room", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, "Main body");
    doc.getText("refs.bib").insert(0, "@article{key}");

    const restored = new Y.Doc();
    applyDocState(restored, encodeDocState(doc));

    expect(restored.getText("main.tex").toString()).toBe("Main body");
    expect(restored.getText("refs.bib").toString()).toBe("@article{key}");
  });

  it("getTextFilesFromDoc matches Y.Text after incremental edits", () => {
    const doc = new Y.Doc();
    const ytext = doc.getText("main.tex");
    ytext.insert(0, "\n\\documentclass{IEEEtran}");
    ytext.delete(0, 1);

    const files = getTextFilesFromDoc(doc);
    expect(files).toEqual([{ path: "main.tex", content: ytext.toString() }]);
    expect(files[0].content).toBe("\\documentclass{IEEEtran}");
  });

  it("filterSyncableTextFiles excludes pdf paths and existing binary rows", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, "\\documentclass{article}");
    doc.getText("dv-voice-assitant-demo-script.pdf").insert(0, "corrupt-if-synced");
    doc.getText("refs.bib").insert(0, "@article{key}");

    const all = getTextFilesFromDoc(doc);
    expect(all.map((f) => f.path)).toContain("dv-voice-assitant-demo-script.pdf");

    const syncable = filterSyncableTextFiles(all, new Set(["uploaded.png"]));
    expect(syncable.map((f) => f.path)).toEqual(["main.tex", "refs.bib"]);
    expect(isSyncableTextPath("dv-voice-assitant-demo-script.pdf")).toBe(false);
    expect(isSyncableTextPath("uploaded.png")).toBe(false);
    expect(isSyncableTextPath("notes")).toBe(true);
    expect(isSyncableTextPath("chapter.tex")).toBe(true);
  });
});
