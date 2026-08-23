const AI_ASSISTANT_ERROR_PATTERNS: RegExp[] = [
  /^The project context is too large/i,
  /^The prompt is too large/i,
  /^Please compile your project first/i,
  /^AI service rate limit/i,
  /^Failed to connect to AI service/i,
  /^Request failed$/i,
  /^The assistant returned an empty response/i,
  /^I couldn't generate a response/i,
];

function isAiAssistantErrorMessage(content: string): boolean {
  const trimmed = content.trim();
  return AI_ASSISTANT_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Whether an assistant reply should show Insert/Replace actions.
 */
export function hasInsertableContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed || isAiAssistantErrorMessage(trimmed)) return false;

  const extracted = extractInsertableContent(trimmed).trim();
  if (!extracted) return false;

  const hasLatexFence = /```(?:latex|tex)\s*\n/i.test(trimmed);
  const hasLatexCommand = /\\[a-zA-Z@*]+/.test(extracted);
  return hasLatexFence || hasLatexCommand;
}

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
