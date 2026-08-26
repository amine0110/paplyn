import { describe, it, expect } from "vitest";
import Y from "./yjs.js";
import type postgres from "postgres";
import {
  PERSIST_ACK_FIELD,
  PERSIST_META_MAP,
  PersistConcatenationError,
  assertNoConcatenatedDocumentUpserts,
  persistRoomState,
  repairConcatenatedTextInDoc,
  syncProjectFilesFromDoc,
} from "./persistence.js";
import { seedDocFromProjectFiles, type ProjectFileRow } from "./room-seed.js";

const SAMPLE =
  "\\documentclass{article}\n\\begin{document}\nHello world\n\\end{document}\n";

function createMockSql(options: {
  textFiles?: Array<{ path: string; content: string }>;
} = {}): { sql: postgres.Sql; written: Map<string, string> } {
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
      // room blob write — no-op for these tests
    }
    return [];
  }) as postgres.Sql;

  return { sql, written };
}

function makeFiles(
  entries: Array<{ path: string; content: string }>
): ProjectFileRow[] {
  return entries.map((e) => ({
    path: e.path,
    content: e.content,
    is_binary: false,
    updated_at: null,
  }));
}

describe("concatenated document persist guard (llm-similarity incident)", () => {
  it("assertNoConcatenatedDocumentUpserts throws when 220 copies would overwrite 1-copy HTTP", () => {
    const clean = SAMPLE;
    const bloated = SAMPLE.repeat(220);
    const existingByPath = new Map([["main.tex", clean]]);

    expect(() =>
      assertNoConcatenatedDocumentUpserts([{ path: "main.tex", content: bloated }], existingByPath)
    ).toThrow(PersistConcatenationError);
  });

  it("repairConcatenatedTextInDoc adopts clean HTTP over stale client replay", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, SAMPLE.repeat(220));

    const repaired = repairConcatenatedTextInDoc(
      doc,
      new Map([["main.tex", SAMPLE]])
    );

    expect(repaired).toBe(1);
    expect(doc.getText("main.tex").toString()).toBe(SAMPLE);
    expect(doc.getText("main.tex").toString().split("\\documentclass").length - 1).toBe(1);
  });

  it("seedDocFromProjectFiles replaces concatenated Y.Text with clean HTTP (no append)", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, SAMPLE.repeat(220));

    const seeded = seedDocFromProjectFiles(
      doc,
      makeFiles([{ path: "main.tex", content: SAMPLE }])
    );

    expect(seeded).toBe(1);
    expect(doc.getText("main.tex").toString()).toBe(SAMPLE);
  });

  it("persistRoomState writes single-copy HTTP, not 220 concatenated copies", async () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, SAMPLE.repeat(220));
    doc.getText("references.bib").insert(0, "@article{key}\n".repeat(2));

    const { sql, written } = createMockSql({
      textFiles: [
        { path: "main.tex", content: SAMPLE },
        { path: "references.bib", content: "@article{key}\n" },
      ],
    });

    await persistRoomState(sql, "0b1003fa-2847-467f-af92-34ade241b1cc", doc);

    expect(written.get("main.tex")).toBe(SAMPLE);
    expect(written.get("main.tex")?.split("\\documentclass").length).toBe(2);
    expect(doc.getMap(PERSIST_META_MAP).get(PERSIST_ACK_FIELD)).toEqual(expect.any(Number));
  });

  it("syncProjectFilesFromDoc refuses bloated upsert when repair is skipped (deploy gate)", async () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, SAMPLE.repeat(220));

    const { sql } = createMockSql({
      textFiles: [{ path: "main.tex", content: SAMPLE }],
    });

    await expect(
      syncProjectFilesFromDoc(sql, "project-1", doc, { skipRepair: true })
    ).rejects.toThrow(PersistConcatenationError);
  });
});
