import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-27/28 AI composer and chat thread deploy gate", () => {
  it("PAP-27: + picker forced tool is resolved inside sendMessage and sent in the request body", () => {
    const sidebar = readSource("components/ai-sidebar.tsx");
    expect(sidebar).toContain("resolveComposerForcedTool");
    expect(sidebar).toContain("selectedToolRef");
    expect(sidebar).toMatch(/selectedToolRef\.current\s*=\s*toolName/);
    expect(sidebar).toContain("forcedTool,");
    expect(sidebar).not.toMatch(/loadingLabelForAction\([^)]*selectedTool/);

    const helper = readSource("lib/ai-composer-forced-tool.ts");
    expect(helper).toContain("optionsForcedTool ?? selectedTool");

    const route = readSource("app/api/projects/[id]/ai/route.ts");
    expect(route).toContain("resolveForcedToolChoice");
    expect(route).toContain('toolChoice: { type: "tool", toolName: forcedToolName }');
    expect(route).toMatch(
      /data\.action && !\(data\.forcedTool && isRegisteredPluginToolName\(data\.forcedTool\)\)/
    );
  });

  it("PAP-28: chat thread lives on the project page, not inside AiSidebar", () => {
    const page = readSource("app/project/[id]/page.tsx");
    expect(page).toContain("useProjectAiChatThread");
    expect(page).toContain("messages={aiChatMessages}");
    expect(page).toContain("setMessages={setAiChatMessages}");
    expect(page).toMatch(/setShowAi\(false\)/);

    const sidebar = readSource("components/ai-sidebar.tsx");
    expect(sidebar).toContain("messages: AiChatMessage[]");
    expect(sidebar).toContain("setMessages: React.Dispatch");
    expect(sidebar).not.toMatch(/useState<Message\[\]>\(\[\]\)/);
    expect(sidebar).not.toMatch(/useState<AiChatMessage\[\]>\(\[\]\)/);

    const hook = readSource("lib/use-project-ai-chat-thread.ts");
    expect(hook).toContain("[projectId]");
    expect(hook).toContain("setMessagesState([])");
  });
});
