import { describe, expect, it } from "vitest";
import { countDocumentStats } from "./document-stats";

describe("countDocumentStats", () => {
  it("counts characters and whitespace-separated words", () => {
    expect(countDocumentStats("hello world")).toEqual({
      characters: 11,
      words: 2,
    });
  });

  it("returns zero words for whitespace-only content", () => {
    const text = "   \n\t  ";
    expect(countDocumentStats(text)).toEqual({
      characters: text.length,
      words: 0,
    });
  });

  it("handles empty strings", () => {
    expect(countDocumentStats("")).toEqual({
      characters: 0,
      words: 0,
    });
  });

  it("counts LaTeX source literally", () => {
    const text = "\\section{Intro}\nSome text here.";
    expect(countDocumentStats(text)).toEqual({
      characters: text.length,
      words: 4,
    });
  });
});
