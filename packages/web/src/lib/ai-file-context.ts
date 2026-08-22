/** Max characters for LaTeX file context in the AI system prompt (~3k tokens). */
export const AI_FILE_CONTEXT_CHAR_LIMIT = 12_000;

export const AI_FILE_TRUNCATION_MARKER = "\n\n[... content truncated for AI context limit ...]\n";

export interface TexFileInput {
  path: string;
  content: string;
}

/** Drop dead content pasted after the first \\end{document}. */
export function trimAfterEndDocument(content: string): string {
  const marker = "\\end{document}";
  const idx = content.indexOf(marker);
  if (idx === -1) return content;
  return content.slice(0, idx + marker.length);
}

function formatFileBlock(path: string, content: string): string {
  return `--- ${path} ---\n${content}`;
}

/**
 * Build a bounded LaTeX file context for the AI system prompt.
 * Prefers the active file, then includes other .tex files until the char cap.
 */
export function buildAiFileContext(
  files: TexFileInput[],
  options?: { activeFile?: string; charLimit?: number }
): string {
  const charLimit = options?.charLimit ?? AI_FILE_CONTEXT_CHAR_LIMIT;
  const activeFile = options?.activeFile;

  const texFiles = files.filter((f) => f.path.endsWith(".tex"));
  if (texFiles.length === 0) return "";

  const active = activeFile ? texFiles.find((f) => f.path === activeFile) : undefined;
  const others = texFiles
    .filter((f) => f.path !== activeFile)
    .sort((a, b) => a.path.localeCompare(b.path));

  const ordered = active ? [active, ...others] : others;
  const blocks: string[] = [];
  let used = 0;

  for (const file of ordered) {
    const trimmed = trimAfterEndDocument(file.content);
    const separator = blocks.length > 0 ? "\n\n" : "";
    const separatorLen = separator.length;
    const remaining = charLimit - used - separatorLen;

    if (remaining <= 0) break;

    const header = `--- ${file.path} ---\n`;
    const fullBlock = formatFileBlock(file.path, trimmed);

    if (fullBlock.length <= remaining) {
      blocks.push(separator + fullBlock);
      used += separatorLen + fullBlock.length;
      continue;
    }

    const contentBudget = remaining - header.length - AI_FILE_TRUNCATION_MARKER.length;
    if (contentBudget > 0) {
      blocks.push(
        separator + header + trimmed.slice(0, contentBudget) + AI_FILE_TRUNCATION_MARKER
      );
    }
    break;
  }

  return blocks.join("");
}
