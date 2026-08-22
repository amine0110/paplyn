import { describe, expect, it } from "vitest";
import { extractInsertableContent } from "./ai-insert-content";

describe("extractInsertableContent", () => {
  it("extracts fenced latex blocks when present", () => {
    const content = `Here is a fix:

\`\`\`latex
\\section{Intro}
Hello world.
\`\`\`

Let me know if you need more.`;

    expect(extractInsertableContent(content)).toBe("\\section{Intro}\nHello world.");
  });

  it("joins multiple latex blocks", () => {
    const content = `\`\`\`tex
\\textbf{A}
\`\`\`

\`\`\`latex
\\textbf{B}
\`\`\``;

    expect(extractInsertableContent(content)).toBe("\\textbf{A}\n\n\\textbf{B}");
  });

  it("returns raw content when no latex fences exist", () => {
    const content = "Use \\cite{smith2020} in your bibliography.";
    expect(extractInsertableContent(content)).toBe(content);
  });
});
