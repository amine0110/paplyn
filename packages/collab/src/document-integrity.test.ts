import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  assertNoConcatenatedDocumentUpserts,
  countDocumentClassLines,
  looksLikeConcatenatedFileContent,
  PersistConcatenationError,
  repairConcatenatedRoomText,
} from "./document-integrity.js";

const CLEAN =
  "\\documentclass{article}\n\\begin{document}\nHello\\end{document}\n";

describe("document-integrity", () => {
  it("counts multiple \\documentclass lines in concatenated manuscripts", () => {
    const bloated = CLEAN.repeat(220);
    expect(countDocumentClassLines(CLEAN)).toBe(1);
    expect(countDocumentClassLines(bloated)).toBe(220);
  });

  it("detects 220-copy concatenation and exact doubles", () => {
    const bloated = CLEAN.repeat(220);
    expect(looksLikeConcatenatedFileContent(bloated, CLEAN)).toBe(true);

    const bib = "@article{key, title={A}}";
    expect(looksLikeConcatenatedFileContent(bib + bib, bib)).toBe(true);
  });

  it("allows normal growth without false positives", () => {
    const grown = CLEAN + "\n% appendix\nMore text.\n";
    expect(looksLikeConcatenatedFileContent(grown, CLEAN)).toBe(false);
  });

  it("allows identity persist when HTTP is already bloated", () => {
    const bloated = CLEAN.repeat(220);
    expect(looksLikeConcatenatedFileContent(bloated, bloated)).toBe(false);
    expect(() =>
      assertNoConcatenatedDocumentUpserts(
        [{ path: "main.tex", content: bloated }],
        new Map([["main.tex", bloated]])
      )
    ).not.toThrow();
  });

  it("still refuses bloated proposed over a cleaner smaller HTTP file", () => {
    const bloated = CLEAN.repeat(220);
    expect(looksLikeConcatenatedFileContent(bloated, CLEAN)).toBe(true);
  });

  it("assertNoConcatenatedDocumentUpserts throws for 220 concatenated copies", () => {
    const bloated = CLEAN.repeat(220);
    expect(() =>
      assertNoConcatenatedDocumentUpserts(
        [{ path: "main.tex", content: bloated }],
        new Map([["main.tex", CLEAN]])
      )
    ).toThrow(PersistConcatenationError);
  });

  it("repairConcatenatedRoomText restores authoritative HTTP after stale client replay", () => {
    const doc = new Y.Doc();
    doc.getText("main.tex").insert(0, CLEAN.repeat(220));

    const authoritative = new Map([["main.tex", CLEAN]]);
    expect(repairConcatenatedRoomText(doc, authoritative, "websocket-client")).toBe(true);
    expect(doc.getText("main.tex").toString()).toBe(CLEAN);
  });

  it("repairConcatenatedRoomText is a no-op for legitimate edits", () => {
    const doc = new Y.Doc();
    const grown = CLEAN + "\n% more\nExtra paragraph.\n";
    doc.getText("main.tex").insert(0, grown);

    const authoritative = new Map([["main.tex", CLEAN]]);
    expect(repairConcatenatedRoomText(doc, authoritative, "websocket-client")).toBe(false);
    expect(doc.getText("main.tex").toString()).toBe(grown);
  });
});

describe("stale client replay after room re-seed", () => {
  it("merging a bloated client doc onto a seeded room is repaired to HTTP", () => {
    const server = new Y.Doc();
    server.getText("main.tex").insert(0, CLEAN);

    const staleClient = new Y.Doc();
    staleClient.getText("main.tex").insert(0, CLEAN.repeat(220));

    Y.applyUpdate(server, Y.encodeStateAsUpdate(staleClient));

    const authoritative = new Map([["main.tex", CLEAN]]);
    expect(server.getText("main.tex").toString().length).toBeGreaterThan(CLEAN.length * 10);
    expect(repairConcatenatedRoomText(server, authoritative, "websocket-client")).toBe(true);
    expect(server.getText("main.tex").toString()).toBe(CLEAN);
  });
});

describe("persist hooks (deploy gate source)", () => {
  it("persistence.ts wires concatenation guards", () => {
    const persistence = readFileSync(
      join(import.meta.dirname, "persistence.ts"),
      "utf8"
    );
    expect(persistence).toContain("assertNoConcatenatedDocumentUpserts");
    expect(persistence).toContain("repairConcatenatedRoomText");
  });
});
