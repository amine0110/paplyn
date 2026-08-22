/**
 * Extract text to insert into the LaTeX editor from an assistant message.
 * When the reply contains fenced LaTeX blocks, insert their contents only.
 * Otherwise insert the raw assistant text.
 */
export function extractInsertableContent(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const latexBlocks: string[] = [];
  const blockRegex = /```(?:latex|tex)\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(trimmed)) !== null) {
    const block = match[1]?.trim();
    if (block) latexBlocks.push(block);
  }

  if (latexBlocks.length > 0) {
    return latexBlocks.join("\n\n");
  }

  return content;
}
