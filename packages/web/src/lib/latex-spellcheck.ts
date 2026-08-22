import { Compartment, type Extension } from "@codemirror/state";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import type NSpell from "nspell";

export interface SpellableWord {
  word: string;
  from: number;
  to: number;
}

type ScanMode =
  | "text"
  | "comment"
  | "inline_math"
  | "display_math"
  | "inline_math_paren"
  | "display_math_bracket";

const COMMAND_ARG_COMMANDS = new Set([
  "cite",
  "citep",
  "citet",
  "ref",
  "eqref",
  "pageref",
  "label",
  "usepackage",
  "documentclass",
  "bibliography",
  "bibliographystyle",
  "input",
  "include",
  "includegraphics",
  "href",
  "url",
  "verb",
]);

export function extractSpellableWords(text: string): SpellableWord[] {
  const words: SpellableWord[] = [];
  let i = 0;
  let mode: ScanMode = "text";
  let braceDepth = 0;
  let skippingBraces = false;

  while (i < text.length) {
    const ch = text[i];

    if (mode === "comment") {
      if (ch === "\n") mode = "text";
      i++;
      continue;
    }

    if (mode === "display_math") {
      if (ch === "$" && text[i + 1] === "$") {
        mode = "text";
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (mode === "display_math_bracket") {
      if (text.startsWith("\\]", i)) {
        mode = "text";
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (mode === "inline_math") {
      if (ch === "$" && text[i - 1] !== "\\") {
        mode = "text";
        i++;
      } else {
        i++;
      }
      continue;
    }

    if (mode === "inline_math_paren") {
      if (text.startsWith("\\)", i)) {
        mode = "text";
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (skippingBraces) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "{") {
        braceDepth++;
        i++;
        continue;
      }
      if (ch === "}") {
        braceDepth--;
        if (braceDepth === 0) skippingBraces = false;
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (ch === "%") {
      mode = "comment";
      i++;
      continue;
    }

    if (ch === "$" && text[i + 1] === "$") {
      mode = "display_math";
      i += 2;
      continue;
    }

    if (ch === "$") {
      mode = "inline_math";
      i++;
      continue;
    }

    if (ch === "\\" && text.startsWith("\\(", i)) {
      mode = "inline_math_paren";
      i += 2;
      continue;
    }

    if (ch === "\\" && text.startsWith("\\[", i)) {
      mode = "display_math_bracket";
      i += 2;
      continue;
    }

    if (ch === "\\") {
      i++;
      if (i < text.length && text[i] === "*") i++;

      const commandStart = i;
      if (i < text.length && text[i] === "@") {
        i++;
        while (i < text.length && /[a-zA-Z]/.test(text[i])) i++;
      } else {
        while (i < text.length && /[a-zA-Z@]/.test(text[i])) i++;
      }

      const commandName = text.slice(commandStart, i).replace(/@$/, "");
      if (i < text.length && text[i] === "*") i++;

      if (i < text.length && text[i] === "{") {
        if (COMMAND_ARG_COMMANDS.has(commandName)) {
          skippingBraces = true;
          braceDepth = 1;
        }
        i++;
      }
      continue;
    }

    if (/[A-Za-z]/.test(ch)) {
      const start = i;
      i++;
      while (i < text.length && /[A-Za-z']/.test(text[i])) i++;
      const word = text.slice(start, i);
      if (/[A-Za-z]{2,}/.test(word) && !/^\d/.test(word)) {
        words.push({ word, from: start, to: i });
      }
      continue;
    }

    i++;
  }

  return words;
}

export function isMisspelledWord(spell: NSpell, word: string): boolean {
  const normalized = word.replace(/^'+|'+$/g, "");
  if (!normalized || !/[A-Za-z]/.test(normalized)) return false;
  if (/^[A-Z]{2,}$/.test(normalized)) return false;
  return !spell.correct(normalized);
}

let spellChecker: NSpell | null = null;
let loadPromise: Promise<NSpell | null> | null = null;

async function loadSpellChecker(): Promise<NSpell | null> {
  if (typeof window === "undefined") return null;
  if (spellChecker) return spellChecker;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const nspellMod = await import("nspell");
      const nspell = nspellMod.default;
      const [affRes, dicRes] = await Promise.all([
        fetch("/spellcheck/index.aff"),
        fetch("/spellcheck/index.dic"),
      ]);
      if (!affRes.ok || !dicRes.ok) return null;
      const [aff, dic] = await Promise.all([affRes.arrayBuffer(), dicRes.arrayBuffer()]);
      const decoder = new TextDecoder("utf-8");
      spellChecker = nspell(decoder.decode(aff), decoder.decode(dic));
      return spellChecker;
    } catch {
      return null;
    }
  })();

  return loadPromise;
}

export async function getSpellChecker(): Promise<NSpell | null> {
  return loadSpellChecker();
}

export function collectMisspellingDiagnostics(text: string, spell: NSpell): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const { word, from, to } of extractSpellableWords(text)) {
    if (isMisspelledWord(spell, word)) {
      diagnostics.push({
        from,
        to,
        severity: "warning",
        message: `Unknown word: ${word}`,
      });
    }
  }
  return diagnostics;
}

export const spellcheckCompartment = new Compartment();

export function spellcheckExtensions(enabled: boolean): Extension[] {
  if (!enabled) return [];

  return [
    linter(
      async (view) => {
        const spell = await loadSpellChecker();
        if (!spell) return [];
        return collectMisspellingDiagnostics(view.state.doc.toString(), spell);
      },
      { delay: 400 }
    ),
  ];
}

export function setSpellcheckEnabled(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: spellcheckCompartment.reconfigure(spellcheckExtensions(enabled)),
  });
}
