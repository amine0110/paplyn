import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("useProjectAiChatThread", () => {
  it("resets messages when projectId changes", () => {
    const src = readSource("lib/use-project-ai-chat-thread.ts");
    expect(src).toContain("useEffect");
    expect(src).toMatch(/\[projectId\]/);
    expect(src).toContain("setMessagesState([])");
  });
});
