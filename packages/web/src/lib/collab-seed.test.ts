import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  getCollabEditorAuthoritativeContent,
  getCollabEditorInitialDoc,
  getOfflineEditorInitialDoc,
  seedYTextIfEmpty,
  shouldClientSeedYText,
  shouldDeferCollabBinding,
  simulateBuggyCollabBuffer,
  simulateFixedCollabBuffer,
} from "./collab-seed";

const SAMPLE = "\\documentclass{article}\n\\begin{document}\nHello\\end{document}\n";

describe("collab-seed", () => {
  it("seeds empty Y.Text from initialContent exactly once", () => {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("main.tex");

    expect(seedYTextIfEmpty(ytext, SAMPLE)).toBe(true);
    expect(ytext.toString()).toBe(SAMPLE);
    expect(seedYTextIfEmpty(ytext, SAMPLE)).toBe(false);
    expect(ytext.toString()).toBe(SAMPLE);
  });

  it("does not seed when Y.Text already has content", () => {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("main.tex");
    ytext.insert(0, "existing");

    expect(seedYTextIfEmpty(ytext, SAMPLE)).toBe(false);
    expect(ytext.toString()).toBe("existing");
  });

  it("shows HTTP initialContent read-only before collab sync, Y.Text after sync", () => {
    expect(shouldDeferCollabBinding(true, false, 0, SAMPLE.length)).toBe(true);
    expect(getCollabEditorInitialDoc("", SAMPLE, false)).toBe(SAMPLE);
    expect(getCollabEditorAuthoritativeContent("", SAMPLE, false)).toBe(SAMPLE);

    expect(shouldDeferCollabBinding(true, true, SAMPLE.length, SAMPLE.length)).toBe(false);
    expect(getCollabEditorInitialDoc(SAMPLE, SAMPLE, true)).toBe(SAMPLE);
    expect(getCollabEditorInitialDoc("", SAMPLE, true)).toBe("");
  });

  it("does not show blank buffer when unsynced empty Y.Text has HTTP manuscript", () => {
    const manuscript = SAMPLE.repeat(200);
    const visible = getCollabEditorInitialDoc("", manuscript, false);
    expect(visible).toBe(manuscript);
    expect(visible.length).toBe(manuscript.length);
  });

  it("offline editor still uses initialContent when Y.Text is empty", () => {
    expect(getOfflineEditorInitialDoc("", SAMPLE)).toBe(SAMPLE);
    expect(getOfflineEditorInitialDoc("live", SAMPLE)).toBe("live");
  });

  it("collab clients do not seed Y.Text from HTTP (server is authoritative)", () => {
    expect(shouldClientSeedYText(true, 0, SAMPLE, false)).toBe(false);
    expect(shouldClientSeedYText(true, 0, SAMPLE, true)).toBe(false);
    expect(shouldClientSeedYText(false, 0, SAMPLE, false)).toBe(true);
    expect(shouldClientSeedYText(false, 0, SAMPLE, true)).toBe(false);
  });

  it("reproduces the pre-fix double buffer (CM + Y.Text seed)", () => {
    const doubled = simulateBuggyCollabBuffer("", SAMPLE, true);
    expect(doubled).toBe(SAMPLE + SAMPLE);
    expect(doubled.length).toBe(SAMPLE.length * 2);
  });

  it("fixed path keeps a single copy after sync seed", () => {
    const once = simulateFixedCollabBuffer("", SAMPLE, true);
    expect(once).toBe(SAMPLE);
    expect(once.length).toBe(SAMPLE.length);
  });

  it("already-concatenated HTTP content is not worsened by reload seed", () => {
    const bloated = SAMPLE.repeat(220);
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("main.tex");

    // Server/client seed only runs when Y.Text is empty.
    expect(seedYTextIfEmpty(ytext, bloated)).toBe(true);
    expect(ytext.toString()).toBe(bloated);

    // Second seed attempt (another tab/reload) is a no-op.
    expect(seedYTextIfEmpty(ytext, bloated)).toBe(false);
    expect(ytext.toString()).toBe(bloated);
    expect(ytext.toString().length).toBe(bloated.length);

    const editorBuffer = simulateFixedCollabBuffer(ytext.toString(), bloated, false);
    expect(editorBuffer).toBe(bloated);
    expect(editorBuffer.length).toBe(bloated.length);
  });

  it("autosave replace semantics: full buffer overwrites, never appends", () => {
    let projectFile = SAMPLE;

    const autosave = (buffer: string) => {
      projectFile = buffer;
    };

    autosave(SAMPLE + SAMPLE);
    expect(projectFile).toBe(SAMPLE + SAMPLE);

    autosave(SAMPLE);
    expect(projectFile).toBe(SAMPLE);
    expect(projectFile).not.toBe(SAMPLE + SAMPLE);
  });
});

describe("multi-client Y.Text seed race", () => {
  it("concurrent client inserts at position 0 concatenate (root cause)", () => {
    const ydoc1 = new Y.Doc();
    const ydoc2 = new Y.Doc();
    Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc1));

    const t1 = ydoc1.getText("main.tex");
    const t2 = ydoc2.getText("main.tex");

    t1.insert(0, SAMPLE);
    Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc1));
    t2.insert(0, SAMPLE);
    Y.applyUpdate(ydoc1, Y.encodeStateAsUpdate(ydoc2));

    expect(ydoc1.getText("main.tex").toString()).toBe(SAMPLE + SAMPLE);
  });

  it("second client/tab does not insert when Y.Text already seeded", () => {
    const serverDoc = new Y.Doc();
    const clientDoc = new Y.Doc();

    seedYTextIfEmpty(serverDoc.getText("main.tex"), SAMPLE);
    Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(serverDoc));

    const clientYtext = clientDoc.getText("main.tex");
    expect(clientYtext.toString()).toBe(SAMPLE);
    expect(seedYTextIfEmpty(clientYtext, SAMPLE)).toBe(false);
    expect(clientYtext.toString()).toBe(SAMPLE);
  });
});
