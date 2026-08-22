import { describe, it, expect, beforeAll } from "vitest";
import nspell from "nspell";
import dictionary from "dictionary-en";
import {
  collectMisspellingDiagnostics,
  extractSpellableWords,
  isMisspelledWord,
} from "@/lib/latex-spellcheck";
import {
  readStoredSpellcheckEnabled,
  SPELLCHECK_STORAGE_KEY,
} from "@/lib/editor-preferences";

function createSpellChecker() {
  const decoder = new TextDecoder("utf-8");
  return nspell(decoder.decode(dictionary.aff), decoder.decode(dictionary.dic));
}

describe("extractSpellableWords", () => {
  it("extracts words from plain text", () => {
    const words = extractSpellableWords("This paragraph has several words.");
    expect(words.map((w) => w.word)).toEqual(["This", "paragraph", "has", "several", "words"]);
  });

  it("skips LaTeX command names", () => {
    const words = extractSpellableWords("\\section{Introduction}\n\\subsection{Background}");
    expect(words.map((w) => w.word)).toEqual(["Introduction", "Background"]);
    expect(words.some((w) => w.word === "section")).toBe(false);
    expect(words.some((w) => w.word === "subsection")).toBe(false);
  });

  it("skips comment lines", () => {
    const words = extractSpellableWords("Visible text\n% hidden mispelled wrd\nMore text");
    expect(words.map((w) => w.word)).toEqual(["Visible", "text", "More", "text"]);
  });

  it("skips inline and display math", () => {
    const words = extractSpellableWords(
      "Before $E=mc^2$ middle $$\\int_0^1 x dx$$ after \\(a+b\\) tail"
    );
    expect(words.map((w) => w.word)).toEqual(["Before", "middle", "after", "tail"]);
  });

  it("skips bibliography command arguments", () => {
    const words = extractSpellableWords("\\cite{smith2020}\\ref{fig:plot}");
    expect(words).toHaveLength(0);
  });

  it("keeps prose inside formatting commands", () => {
    const words = extractSpellableWords("The \\textbf{bold} statement.");
    expect(words.map((w) => w.word)).toEqual(["The", "bold", "statement"]);
  });
});

describe("isMisspelledWord", () => {
  let spell: ReturnType<typeof createSpellChecker>;

  beforeAll(() => {
    spell = createSpellChecker();
  });

  it("flags unknown English words", () => {
    expect(isMisspelledWord(spell, "tset")).toBe(true);
    expect(isMisspelledWord(spell, "spellng")).toBe(true);
  });

  it("accepts known English words", () => {
    expect(isMisspelledWord(spell, "hello")).toBe(false);
    expect(isMisspelledWord(spell, "introduction")).toBe(false);
  });

  it("ignores all-caps acronyms", () => {
    expect(isMisspelledWord(spell, "IEEE")).toBe(false);
  });
});

describe("collectMisspellingDiagnostics", () => {
  let spell: ReturnType<typeof createSpellChecker>;

  beforeAll(() => {
    spell = createSpellChecker();
  });

  it("reports misspellings in prose but not in commands", () => {
    const text = "\\section{Intro}\nThis sentance has a tset.";
    const diagnostics = collectMisspellingDiagnostics(text, spell);
    expect(diagnostics.map((d) => text.slice(d.from, d.to))).toEqual(["sentance", "tset"]);
  });
});

describe("editor spellcheck preference", () => {
  it("defaults to enabled", () => {
    expect(readStoredSpellcheckEnabled()).toBe(true);
  });

  it("uses a stable storage key", () => {
    expect(SPELLCHECK_STORAGE_KEY).toBe("quire-spellcheck");
  });
});
