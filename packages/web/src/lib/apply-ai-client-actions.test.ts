import { describe, expect, it } from "vitest";
import { normalizeInsertAtCursorText } from "./apply-ai-client-actions";

describe("normalizeInsertAtCursorText", () => {
  it("adds a trailing newline when inserting a comment before documentclass at file start", () => {
    const doc = "\\documentclass[conference]{IEEEtran}";
    const insert = "% agent-smoke-test-54";
    expect(normalizeInsertAtCursorText(insert, doc, 0)).toBe("% agent-smoke-test-54\n");
  });

  it("leaves text unchanged when it already ends with a newline", () => {
    const doc = "\\documentclass{article}";
    const insert = "% comment\n";
    expect(normalizeInsertAtCursorText(insert, doc, 0)).toBe("% comment\n");
  });

  it("leaves text unchanged when the next character is whitespace", () => {
    const doc = "See  Smith";
    const insert = "\\cite{smith2020}";
    expect(normalizeInsertAtCursorText(insert, doc, 4)).toBe("\\cite{smith2020}");
  });

  it("leaves text unchanged at end of file", () => {
    const doc = "\\end{document}";
    const insert = "% trailing note";
    expect(normalizeInsertAtCursorText(insert, doc, doc.length)).toBe("% trailing note");
  });

  it("places a mid-line comment on its own line", () => {
    const doc = "helloworld";
    const insert = "% note";
    expect(normalizeInsertAtCursorText(insert, doc, 5)).toBe("\n% note\n");
  });

  it("adds only a trailing newline for non-comment inline inserts", () => {
    const doc = "SeeSmith";
    const insert = "\\cite{smith2020}";
    expect(normalizeInsertAtCursorText(insert, doc, 3)).toBe("\\cite{smith2020}\n");
  });
});
