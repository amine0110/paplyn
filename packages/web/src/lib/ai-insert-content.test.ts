import { describe, expect, it } from "vitest";
import { extractInsertableContent, hasInsertableContent } from "./ai-insert-content";

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

describe("hasInsertableContent", () => {
  it("hides insert actions for service error replies", () => {
    expect(
      hasInsertableContent(
        "The project context is too large for the AI service. Try asking about a specific file or selection."
      )
    ).toBe(false);
    expect(hasInsertableContent("Please compile your project first so I can see the current errors.")).toBe(
      false
    );
  });

  it("shows insert actions when latex is present", () => {
    expect(hasInsertableContent("```latex\n\\section{A}\n```")).toBe(true);
    expect(hasInsertableContent("Use \\cite{smith2020} in your bibliography.")).toBe(true);
  });

  it("hides insert actions for plain prose", () => {
    expect(hasInsertableContent("I fixed the missing brace in your introduction.")).toBe(false);
  });
});
