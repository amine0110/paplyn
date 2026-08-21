import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  applyDocState,
  decodeStoredState,
  encodeDocState,
  encodeStoredState,
  isDocEmpty,
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
});
