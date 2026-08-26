import { describe, it, expect } from "vitest";
import Y, { type Text } from "./yjs.js";
import { seedDocFromProjectFiles, type ProjectFileRow } from "./room-seed.js";

const SAMPLE = "\\documentclass{article}\n\\begin{document}\nHi\\end{document}\n";

function makeFiles(
  entries: Array<{ path: string; content: string; is_binary?: boolean; updated_at?: Date }>
): ProjectFileRow[] {
  return entries.map((e) => ({
    path: e.path,
    content: e.content,
    is_binary: e.is_binary ?? false,
    updated_at: e.updated_at ?? null,
  }));
}

describe("seedDocFromProjectFiles", () => {
  it("seeds empty Y.Text from project_file rows once", () => {
    const doc = new Y.Doc();
    const files = makeFiles([{ path: "main.tex", content: SAMPLE }]);

    expect(seedDocFromProjectFiles(doc, files)).toBe(1);
    expect(doc.getText("main.tex").toString()).toBe(SAMPLE);

    expect(seedDocFromProjectFiles(doc, files)).toBe(0);
    expect(doc.getText("main.tex").toString()).toBe(SAMPLE);
  });

  it("skips binary files and leaves existing Y.Text untouched", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, "live edits");

    const files = makeFiles([
      { path: "main.tex", content: SAMPLE },
      { path: "figure.png", content: "binary", is_binary: true },
      { path: "refs.bib", content: "@article{key}" },
    ]);

    expect(seedDocFromProjectFiles(doc, files)).toBe(1);
    expect(doc.getText("main.tex").toString()).toBe("live edits");
    expect(doc.getText("refs.bib").toString()).toBe("@article{key}");
    expect(doc.getText("figure.png").toString()).toBe("");
  });

  it("does not worsen already-bloated HTTP content on re-bind", () => {
    const bloated = SAMPLE.repeat(220);
    const doc = new Y.Doc();
    const files = makeFiles([{ path: "main.tex", content: bloated }]);

    expect(seedDocFromProjectFiles(doc, files)).toBe(1);
    expect(doc.getText("main.tex").toString()).toBe(bloated);

    // Simulates another tab / server re-bind with the same HTTP payload.
    expect(seedDocFromProjectFiles(doc, files)).toBe(0);
    expect(doc.getText("main.tex").toString()).toBe(bloated);
    expect(doc.getText("main.tex").length).toBe(bloated.length);
  });

  it("replaces concatenated Y.Text with clean HTTP on re-bind (stale client replay)", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, SAMPLE.repeat(220));

    const files = makeFiles([{ path: "main.tex", content: SAMPLE }]);
    expect(seedDocFromProjectFiles(doc, files)).toBe(1);
    expect(doc.getText("main.tex").toString()).toBe(SAMPLE);
    expect(doc.getText("main.tex").toString().split("\\documentclass").length - 1).toBe(1);
  });

  it("adopts newer HTTP project_file when collab room blob is older", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, "stale yjs without marker");

    const collabRoomUpdatedAt = new Date("2026-08-23T18:33:27.000Z");
    const httpUpdatedAt = new Date("2026-08-23T18:33:28.000Z");
    const httpContent = "stale yjs without marker\n% persist-ack-llmsim-20260823";

    const files = makeFiles([
      { path: "main.tex", content: httpContent, updated_at: httpUpdatedAt },
    ]);

    expect(
      seedDocFromProjectFiles(doc, files, { collabRoomUpdatedAt })
    ).toBe(1);
    expect(doc.getText("main.tex").toString()).toBe(httpContent);
  });

  it("does not replace Y.Text when HTTP is older than collab room blob", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, "live collab edits");

    const collabRoomUpdatedAt = new Date("2026-08-23T18:33:27.000Z");
    const httpUpdatedAt = new Date("2026-08-23T18:33:18.000Z");

    const files = makeFiles([
      {
        path: "main.tex",
        content: "older http with % persist-ack-llmsim-20260823",
        updated_at: httpUpdatedAt,
      },
    ]);

    expect(seedDocFromProjectFiles(doc, files, { collabRoomUpdatedAt })).toBe(0);
    expect(doc.getText("main.tex").toString()).toBe("live collab edits");
  });

  it("server seed prevents multi-client Y.Text duplication race", () => {
    const serverDoc = new Y.Doc();
    const client1 = new Y.Doc();
    const client2 = new Y.Doc();

    seedDocFromProjectFiles(serverDoc, makeFiles([{ path: "main.tex", content: SAMPLE }]));

    Y.applyUpdate(client1, Y.encodeStateAsUpdate(serverDoc));
    Y.applyUpdate(client2, Y.encodeStateAsUpdate(serverDoc));

    // Old client path: both would insert when empty.
    expect(seedYTextIfEmpty(client1.getText("main.tex"), SAMPLE)).toBe(false);
    expect(seedYTextIfEmpty(client2.getText("main.tex"), SAMPLE)).toBe(false);

    Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(client1));
    Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(client2));

    expect(serverDoc.getText("main.tex").toString()).toBe(SAMPLE);
  });
});

function seedYTextIfEmpty(ytext: Text, initialContent: string): boolean {
  if (ytext.length > 0 || initialContent.length === 0) return false;
  ytext.insert(0, initialContent);
  return true;
}
