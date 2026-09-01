import type { Tool } from "ai";
import { describe, expect, it } from "vitest";
import { PLUGIN_TOOL_NAMES } from "@/lib/ai-plugins/forced-tool";
import { resolveAiPlugins } from "@/lib/ai-plugins";
import {
  CLIENT_ACTION_TOOL_NAMES,
  WORKSPACE_READ_TOOL_NAMES,
  WORKSPACE_TOOL_NAMES,
} from "@/lib/ai-plugins/workspace-tools";
import {
  classifyAiIntent,
  classifyAiIntentFallback,
  getAllowedPluginToolNames,
  pluginToolNamesForIntent,
  toolsForIntent,
  wrapPluginToolsWithPolicy,
} from "./ai-intent";

function stubTools(names: readonly string[]): Record<string, Tool> {
  return Object.fromEntries(names.map((name) => [name, {} as Tool]));
}

const allPluginTools = stubTools(PLUGIN_TOOL_NAMES);
const allWorkspaceTools = stubTools(WORKSPACE_TOOL_NAMES);

describe("classifyAiIntentFallback", () => {
  it("maps compile-fix to edit", () => {
    expect(
      classifyAiIntentFallback({
        message: "Fix compile errors",
        compileFix: true,
      })
    ).toBe("edit");
  });

  it("maps forced Zotero to library", () => {
    expect(
      classifyAiIntentFallback({
        message: "anything",
        forcedTool: "search_zotero",
      })
    ).toBe("library");
  });

  it("classifies rewrite abstract as edit", () => {
    expect(
      classifyAiIntentFallback({
        message: "Rewrite the abstract to mention contrastive learning",
      })
    ).toBe("edit");
  });

  it("classifies compile warning review as edit", () => {
    expect(
      classifyAiIntentFallback({
        message: "we have several warnings, can you check?",
        compileDiagnostics: true,
      })
    ).toBe("edit");
  });

  it("classifies section questions as chat", () => {
    expect(
      classifyAiIntentFallback({
        message: "What is section 3 saying?",
      })
    ).toBe("chat");
  });

  it("classifies literature search without Zotero", () => {
    expect(
      classifyAiIntentFallback({
        message: "Find papers on stance detection",
      })
    ).toBe("literature");
  });

  it("classifies explicit Zotero search as library", () => {
    expect(
      classifyAiIntentFallback({
        message: "Search my Zotero for BERT",
      })
    ).toBe("library");
  });

  it("never classifies ambiguous paper edits as library", () => {
    expect(
      classifyAiIntentFallback({
        message: "Rewrite the abstract to mention contrastive learning",
      })
    ).not.toBe("library");
  });
});

describe("classifyAiIntent", () => {
  it("uses overrides without calling the model", async () => {
    await expect(
      classifyAiIntent({
        message: "Search my Zotero for BERT",
        forcedTool: "search_zotero",
      })
    ).resolves.toBe("library");
  });
});

describe("toolsForIntent", () => {
  it("omits search_zotero for edit requests", () => {
    const tools = toolsForIntent("edit", allPluginTools, allWorkspaceTools);
    expect("search_zotero" in tools).toBe(false);
    expect("apply_edit" in tools).toBe(true);
    expect("replace_lines" in tools).toBe(true);
  });

  it("mounts read-only workspace tools for chat", () => {
    const tools = toolsForIntent("chat", allPluginTools, allWorkspaceTools);
    expect("search_zotero" in tools).toBe(false);
    expect("search_literature" in tools).toBe(false);
    expect("list_files" in tools).toBe(true);
    expect("get_file" in tools).toBe(true);
    expect("get_compile_diagnostics" in tools).toBe(false);
    for (const name of CLIENT_ACTION_TOOL_NAMES) {
      expect(name in tools).toBe(false);
    }
  });

  it("mounts compile diagnostics tool when requested", () => {
    const tools = toolsForIntent("edit", allPluginTools, allWorkspaceTools, {
      includeCompileDiagnostics: true,
    });
    expect("get_compile_diagnostics" in tools).toBe(true);
    expect("apply_edit" in tools).toBe(true);
  });

  it("mounts literature tools but not Zotero", () => {
    const tools = toolsForIntent("literature", allPluginTools, allWorkspaceTools);
    expect("search_literature" in tools).toBe(true);
    expect("search_arxiv" in tools).toBe(true);
    expect("search_zotero" in tools).toBe(false);
  });

  it("mounts search_zotero for library intent", () => {
    const tools = toolsForIntent("library", allPluginTools, allWorkspaceTools);
    expect("search_zotero" in tools).toBe(true);
    expect("search_literature" in tools).toBe(false);
  });
});

describe("plugin tool policy", () => {
  it("blocks plugin tools outside the allow-list", async () => {
    const executed: string[] = [];
    const pluginTools = {
      search_zotero: {
        execute: async () => {
          executed.push("search_zotero");
          return { ok: true };
        },
      } as Tool,
      search_literature: {
        execute: async () => {
          executed.push("search_literature");
          return { ok: true };
        },
      } as Tool,
    };

    const wrapped = wrapPluginToolsWithPolicy(
      pluginTools,
      new Set(["search_literature"])
    );

    const blocked = await wrapped.search_zotero?.execute?.({}, {} as never);
    expect(blocked).toMatchObject({
      kind: "plugin-tool-blocked",
      toolName: "search_zotero",
    });
    expect(executed).toEqual([]);

    await wrapped.search_literature?.execute?.({}, {} as never);
    expect(executed).toEqual(["search_literature"]);
  });

  it("allows only the forced plugin tool during forced turns", () => {
    const allowed = getAllowedPluginToolNames({
      intent: "library",
      forcedToolName: "search_zotero",
      compileFix: false,
    });
    expect([...allowed]).toEqual(["search_zotero"]);
  });

  it("keeps forced Zotero on library intent with search_zotero mounted", () => {
    const tools = toolsForIntent("library", allPluginTools, allWorkspaceTools);
    expect("search_zotero" in tools).toBe(true);
    expect(
      classifyAiIntentFallback({
        message: "Search my Zotero for BERT",
        forcedTool: "search_zotero",
      })
    ).toBe("library");
  });

  it("allows no plugin tools during compile-fix", () => {
    const allowed = getAllowedPluginToolNames({
      intent: "edit",
      compileFix: true,
    });
    expect(allowed.size).toBe(0);
  });
});

describe("pluginSystemPromptForIntent integration", () => {
  it("includes Zotero guidance only for library intent", () => {
    const { plugins } = resolveAiPlugins();
    const libraryTools = new Set(pluginToolNamesForIntent("library"));
    const editTools = new Set(pluginToolNamesForIntent("edit"));

    const zoteroPlugin = plugins.find((plugin) => plugin.id === "zotero");
    expect(zoteroPlugin?.systemPrompt).toBeTruthy();
    expect(libraryTools.has("search_zotero")).toBe(true);
    expect(editTools.has("search_zotero")).toBe(false);
  });
});

describe("workspace read-only gating", () => {
  it("keeps chat on read-only workspace tools", () => {
    for (const name of WORKSPACE_READ_TOOL_NAMES) {
      expect(WORKSPACE_TOOL_NAMES).toContain(name);
    }
  });
});
