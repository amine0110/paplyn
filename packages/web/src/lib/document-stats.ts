export interface DocumentStats {
  characters: number;
  words: number;
}

/** Count characters and words in a LaTeX/text source buffer. */
export function countDocumentStats(text: string): DocumentStats {
  const characters = text.length;
  const trimmed = text.trim();
  if (!trimmed) {
    return { characters, words: 0 };
  }

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  return { characters, words };
}
