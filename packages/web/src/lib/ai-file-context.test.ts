import { describe, it, expect } from "vitest";
import {
  AI_FILE_CONTEXT_CHAR_LIMIT,
  AI_FILE_TRUNCATION_MARKER,
  buildAiFileContext,
  trimAfterEndDocument,
} from "@/lib/ai-file-context";

describe("trimAfterEndDocument", () => {
  it("keeps content when no end marker", () => {
    expect(trimAfterEndDocument("\\documentclass{article}\nHello")).toBe(
      "\\documentclass{article}\nHello"
    );
  });

  it("drops content after first \\end{document}", () => {
    const input =
      "\\documentclass{article}\n\\begin{document}\nHi\n\\end{document}\nPASTED IEEE PAPER\n\\documentclass{IEEE}";
    expect(trimAfterEndDocument(input)).toBe(
      "\\documentclass{article}\n\\begin{document}\nHi\n\\end{document}"
    );
  });
});

describe("buildAiFileContext", () => {
  it("prefers active file first", () => {
    const result = buildAiFileContext(
      [
        { path: "other.tex", content: "other content" },
        { path: "main.tex", content: "active content" },
      ],
      { activeFile: "main.tex" }
    );
    expect(result.indexOf("main.tex")).toBeLessThan(result.indexOf("other.tex"));
    expect(result).toContain("active content");
    expect(result).toContain("other content");
  });

  it("includes only active file when others do not fit", () => {
    const bigActive = "A".repeat(11_950);
    const result = buildAiFileContext(
      [
        { path: "main.tex", content: bigActive },
        { path: "extra.tex", content: "should not appear" },
      ],
      { activeFile: "main.tex", charLimit: 12_000 }
    );
    expect(result).toContain(bigActive);
    expect(result).not.toContain("should not appear");
  });

  it("truncates with marker when a file exceeds remaining budget", () => {
    const result = buildAiFileContext(
      [{ path: "main.tex", content: "X".repeat(20_000) }],
      { charLimit: 500 }
    );
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result).toContain(AI_FILE_TRUNCATION_MARKER);
    expect(result).toContain("--- main.tex ---");
  });

  it("trims dead paste before applying the cap", () => {
    const deadPaste = "\n\\end{document}\n" + "Z".repeat(50_000);
    const result = buildAiFileContext(
      [{ path: "main.tex", content: "\\begin{document}\nHello" + deadPaste }],
      { charLimit: AI_FILE_CONTEXT_CHAR_LIMIT }
    );
    expect(result).not.toContain("ZZZZ");
    expect(result).toContain("\\end{document}");
  });

  it("returns empty string when no tex files", () => {
    expect(buildAiFileContext([{ path: "refs.bib", content: "@article{}" }])).toBe("");
  });
});
