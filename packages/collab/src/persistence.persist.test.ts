import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import * as Yesm from "yjs";
import Y, { YJS_CJS_PATH } from "./yjs.js";
import type postgres from "postgres";
import {
  PERSIST_ACK_FIELD,
  PERSIST_META_MAP,
  PersistEmptyWipeError,
  PersistExtractError,
  assertNoEmptyWipeUpserts,
  assertSyncableFilesExtracted,
  getSyncableTextPathsFromDoc,
  getTextFilesFromDoc,
  persistRoomState,
  syncProjectFilesFromDoc,
} from "./persistence.js";

const require = createRequire(import.meta.url);
const Ycjs = require(YJS_CJS_PATH) as typeof import("yjs");

function createCjsDocWithTex(path: string, content: string) {
  const doc = new Ycjs.Doc();
  doc.getText(path).insert(0, content);
  return doc;
}

function createMockSql(options: {
  binaryPaths?: string[];
  textFiles?: Array<{ path: string; content: string }>;
  failUpsert?: boolean;
} = {}): postgres.Sql {
  const binaryPaths = new Set(options.binaryPaths ?? []);
  const textFiles = new Map((options.textFiles ?? []).map((f) => [f.path, f.content]));
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("");
    if (query.includes("SELECT path FROM project_file") && query.includes("is_binary = true")) {
      return [...binaryPaths].map((path) => ({ path }));
    }
    if (query.includes("SELECT path, content FROM project_file") && query.includes("is_binary = false")) {
      return [...textFiles.entries()].map(([path, content]) => ({ path, content }));
    }
    if (query.includes("INSERT INTO project_file")) {
      if (options.failUpsert) {
        throw new Error("db write failed");
      }
    }
    return [];
  }) as postgres.Sql;
  return sql;
}

describe("dual Yjs realm extraction", () => {
  it("instanceof ESM Y.Text fails on CJS doc but duck-type extraction succeeds", () => {
    const doc = createCjsDocWithTex("main.tex", "% persist-ack-llmsim-20260823\\n\\documentclass{article}");

    const ytext = doc.getText("main.tex");
    expect(ytext instanceof Yesm.Text).toBe(false);

    // Pre-fix instanceof path returned 0 files (the production bug).
    let instanceofCount = 0;
    doc.share.forEach((sharedType: unknown) => {
      if (sharedType instanceof Yesm.Text) instanceofCount += 1;
    });
    expect(instanceofCount).toBe(0);

    const files = getTextFilesFromDoc(doc);
    expect(files).toEqual([{ path: "main.tex", content: ytext.toString() }]);
    expect(getSyncableTextPathsFromDoc(doc)).toEqual(["main.tex"]);
  });

  it("syncProjectFilesFromDoc writes CJS doc text into project_file", async () => {
    const doc = createCjsDocWithTex("main.tex", "\\documentclass{article}");
    const sql = createMockSql();
    const result = await syncProjectFilesFromDoc(sql, "project-1", doc);
    expect(result).toEqual({ extractedCount: 1, syncableCount: 1, writtenCount: 1 });
  });
});

describe("persist ack guard", () => {
  it("assertSyncableFilesExtracted throws when syncable paths exist but extraction is empty", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, "live edits");
    expect(getSyncableTextPathsFromDoc(doc)).toEqual(["main.tex"]);

    expect(() => assertSyncableFilesExtracted(doc, [], new Set())).toThrow(PersistExtractError);
  });

  it("does not signal persist ack when extraction validation fails (instanceof lie path)", () => {
    const doc = createCjsDocWithTex("main.tex", "live edits");

    // Simulate pre-fix instanceof extraction (0 files) while duck-typed path detection still works.
    let instanceofCount = 0;
    doc.share.forEach((sharedType: unknown) => {
      if (sharedType instanceof Yesm.Text) instanceofCount += 1;
    });
    expect(instanceofCount).toBe(0);
    expect(getSyncableTextPathsFromDoc(doc)).toEqual(["main.tex"]);

    const brokenExtract = (() => {
      const files: Array<{ path: string; content: string }> = [];
      doc.share.forEach((sharedType, path) => {
        if (sharedType instanceof Yesm.Text) {
          files.push({ path, content: sharedType.toString() });
        }
      });
      return files;
    })();
    expect(brokenExtract).toEqual([]);

    expect(() => assertSyncableFilesExtracted(doc, brokenExtract, new Set())).toThrow(
      PersistExtractError
    );
    expect(doc.getMap(PERSIST_META_MAP).get(PERSIST_ACK_FIELD)).toBeUndefined();
  });

  it("does not signal persist ack when project_file sync fails", async () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, "live edits");

    await expect(persistRoomState(createMockSql({ failUpsert: true }), "room-1", doc)).rejects.toThrow(
      "db write failed"
    );
    expect(doc.getMap(PERSIST_META_MAP).get(PERSIST_ACK_FIELD)).toBeUndefined();
  });

  it("signals persist ack only after successful project_file sync", async () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, "saved");

    await persistRoomState(createMockSql(), "room-1", doc);
    expect(doc.getMap(PERSIST_META_MAP).get(PERSIST_ACK_FIELD)).toEqual(expect.any(Number));
  });

  it("PersistExtractError captures expected vs extracted file counts", () => {
    const err = new PersistExtractError(2, 0);
    expect(err.expectedSyncablePaths).toBe(2);
    expect(err.extractedFiles).toBe(0);
    expect(err.message).toContain("dual Yjs realm");
  });
});

describe("empty HTTP wipe guard", () => {
  it("assertNoEmptyWipeUpserts throws when extracted content is empty but room Y.Text is non-empty", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, "x".repeat(311_498));

    expect(() =>
      assertNoEmptyWipeUpserts(doc, [{ path: "main.tex", content: "" }], new Map())
    ).toThrow(PersistEmptyWipeError);
  });

  it("assertNoEmptyWipeUpserts throws when extracted content is empty but HTTP project_file is non-empty", () => {
    const doc = new Y.Doc();

    expect(() =>
      assertNoEmptyWipeUpserts(
        doc,
        [{ path: "references.bib", content: "" }],
        new Map([["references.bib", "@article{key}"]])
      )
    ).toThrow(PersistEmptyWipeError);
  });

  it("does not signal persist ack when poisoned extraction would wipe room content", async () => {
    const doc = new Y.Doc();
    const ytext = doc.getText("main.tex");
    ytext.insert(0, "x".repeat(311_498));
    const bib = doc.getText("references.bib");
    bib.insert(0, "@article{key}");

    // Dual-realm poison: duck-type passes, length > 0, but toString() returns "".
    Object.defineProperty(ytext, "toString", { value: () => "" });
    Object.defineProperty(bib, "toString", { value: () => "" });

    expect(getTextFilesFromDoc(doc)).toEqual([
      { path: "main.tex", content: "" },
      { path: "references.bib", content: "" },
    ]);
    expect(ytext.length).toBeGreaterThan(0);

    await expect(
      persistRoomState(
        createMockSql({
          textFiles: [
            { path: "main.tex", content: "x".repeat(100) },
            { path: "references.bib", content: "@article{key}" },
          ],
        }),
        "llm-similarity",
        doc
      )
    ).rejects.toThrow(PersistEmptyWipeError);
    expect(doc.getMap(PERSIST_META_MAP).get(PERSIST_ACK_FIELD)).toBeUndefined();
  });

  it("allows empty upsert when both room and HTTP are already empty", async () => {
    const doc = new Y.Doc();
    doc.getText("main.tex");

    const result = await syncProjectFilesFromDoc(
      createMockSql({ textFiles: [{ path: "main.tex", content: "" }] }),
      "project-1",
      doc
    );
    expect(result.writtenCount).toBe(1);
  });

  it("PersistEmptyWipeError captures path and lengths", () => {
    const err = new PersistEmptyWipeError("main.tex", 311_498, 42);
    expect(err.path).toBe("main.tex");
    expect(err.roomTextLength).toBe(311_498);
    expect(err.existingHttpLength).toBe(42);
    expect(err.message).toContain("refuse empty HTTP upsert");
  });
});
