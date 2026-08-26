import { describe, it, expect, vi } from "vitest";
import Y from "./yjs.js";
import type postgres from "postgres";
import {
  PERSIST_ACK_FIELD,
  PERSIST_META_MAP,
  persistRoomState,
  syncProjectFilesFromDoc,
} from "./persistence.js";
import {
  PersistConcatenationError,
  assertNoConcatenatedDocumentUpserts,
  repairConcatenatedRoomText,
} from "./document-integrity.js";
import { seedDocFromProjectFiles, type ProjectFileRow } from "./room-seed.js";

const CLEAN =
  "\\documentclass{article}\n\\begin{document}\nHello world\n\\end{document}\n";

function createMockSql(options: {
  textFiles?: Array<{ path: string; content: string }>;
} = {}): { sql: postgres.Sql; written: Map<string, string>; textFiles: Map<string, string> } {
  const textFiles = new Map((options.textFiles ?? []).map((f) => [f.path, f.content]));
  const written = new Map<string, string>();

  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("");
    if (query.includes("SELECT path FROM project_file") && query.includes("is_binary = true")) {
      return [];
    }
    if (query.includes("SELECT path, content FROM project_file") && query.includes("is_binary = false")) {
      return [...textFiles.entries()].map(([path, content]) => ({ path, content }));
    }
    if (query.includes("INSERT INTO project_file")) {
      const path = values[2] as string;
      const content = values[3] as string;
      written.set(path, content);
      textFiles.set(path, content);
    }
    if (query.includes("INSERT INTO collab_room")) {
      // tracked separately when needed
    }
    return [];
  }) as postgres.Sql;

  return { sql, written, textFiles };
}

function makeFiles(entries: Array<{ path: string; content: string }>): ProjectFileRow[] {
  return entries.map((e) => ({
    path: e.path,
    content: e.content,
    is_binary: false,
    updated_at: null,
  }));
}

describe("concatenated document persist guard (llm-similarity incident)", () => {
  const BLOATED = CLEAN.repeat(220);

  it("deploy gate: 1-copy HTTP + 220-copy extract throws and leaves HTTP unchanged", async () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, BLOATED);

    const { sql, written, textFiles } = createMockSql({
      textFiles: [{ path: "main.tex", content: CLEAN }],
    });

    const repairSpy = vi.spyOn(
      await import("./document-integrity.js"),
      "repairConcatenatedRoomText"
    );
    repairSpy.mockReturnValue(false);

    await expect(
      syncProjectFilesFromDoc(sql, "project-1", doc)
    ).rejects.toThrow(PersistConcatenationError);

    expect(written.has("main.tex")).toBe(false);
    expect(textFiles.get("main.tex")).toBe(CLEAN);
    repairSpy.mockRestore();
  });

  it("repairConcatenatedRoomText adopts clean HTTP over stale client replay", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, BLOATED);

    expect(repairConcatenatedRoomText(doc, new Map([["main.tex", CLEAN]]), "client")).toBe(true);
    expect(doc.getText("main.tex").toString()).toBe(CLEAN);
  });

  it("seedDocFromProjectFiles replaces concatenated Y.Text with clean HTTP (no append)", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, BLOATED);

    expect(seedDocFromProjectFiles(doc, makeFiles([{ path: "main.tex", content: CLEAN }]))).toBe(1);
    expect(doc.getText("main.tex").toString()).toBe(CLEAN);
  });

  it("seedDocFromProjectFiles collapses concatenated HTTP into empty Y.Text (never inserts raw stack)", () => {
    const doc = new Y.Doc();
    const bloated = CLEAN.repeat(220);

    expect(seedDocFromProjectFiles(doc, makeFiles([{ path: "main.tex", content: bloated }]))).toBe(1);
    const seeded = doc.getText("main.tex").toString();
    expect(seeded.split("\\documentclass").length - 1).toBe(1);
    expect(seeded).toContain("\\end{document}");
    expect(seeded.length).toBeLessThan(bloated.length);
  });

  it("persistRoomState repairs then writes single-copy HTTP, not 220 concatenated copies", async () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, BLOATED);

    const { sql, written } = createMockSql({
      textFiles: [{ path: "main.tex", content: CLEAN }],
    });

    await persistRoomState(sql, "0b1003fa-2847-467f-af92-34ade241b1cc", doc);

    expect(written.get("main.tex")).toBe(CLEAN);
    expect(doc.getText("main.tex").toString()).toBe(CLEAN);
    expect(doc.getMap(PERSIST_META_MAP).get(PERSIST_ACK_FIELD)).toEqual(expect.any(Number));
  });

  it("does not signal persist ack when guard blocks and HTTP stays clean", async () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, BLOATED);

    const { sql, textFiles } = createMockSql({
      textFiles: [{ path: "main.tex", content: CLEAN }],
    });

    const repairSpy = vi.spyOn(
      await import("./document-integrity.js"),
      "repairConcatenatedRoomText"
    );
    repairSpy.mockReturnValue(false);

    await expect(
      persistRoomState(sql, "room-blocked", doc)
    ).rejects.toThrow(PersistConcatenationError);
    expect(textFiles.get("main.tex")).toBe(CLEAN);
    expect(doc.getMap(PERSIST_META_MAP).get(PERSIST_ACK_FIELD)).toBeUndefined();
    repairSpy.mockRestore();
  });

  it("assertNoConcatenatedDocumentUpserts blocks 220-copy main.tex over clean HTTP", () => {
    expect(() =>
      assertNoConcatenatedDocumentUpserts(
        [{ path: "main.tex", content: BLOATED }],
        new Map([["main.tex", CLEAN]])
      )
    ).toThrow(PersistConcatenationError);
  });

  it("identity persist succeeds when room matches already-bloated HTTP (llm-similarity live room)", async () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, BLOATED);

    const { sql, written } = createMockSql({
      textFiles: [{ path: "main.tex", content: BLOATED }],
    });

    await persistRoomState(sql, "0b1003fa-2847-467f-af92-34ade241b1cc", doc);

    expect(written.get("main.tex")).toBe(BLOATED);
    expect(doc.getMap(PERSIST_META_MAP).get(PERSIST_ACK_FIELD)).toEqual(expect.any(Number));
  });
});
