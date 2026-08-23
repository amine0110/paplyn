import { NextRequest, NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateText, type GenerateTextResult, type ToolSet } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectFile, organization } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { config } from "@/lib/config";
import {
  aiNotConfiguredMessage,
  readAiEnvFromProcess,
  resolveHostedAiConfig,
  resolveSelfHostedAiConfig,
} from "@/lib/ai-config";
import { buildAiFileContext } from "@/lib/ai-file-context";
import {
  buildAiCompileFixContext,
  normalizeAiCompileErrors,
  type AiCompileError,
} from "@/lib/ai-compile-fix-context";
import { detectFixCompileIntent } from "@/lib/ai-compile-fix-intent";
import { getPluginActionPrompt, resolveAiPlugins } from "@/lib/ai-plugins";
import {
  collectPapersFromToolResults,
  collectUsedPlugins,
  collectClientActionsFromToolResults,
  toAppliedActionSummaries,
  formatToolResultsAsAssistantMessage,
  hadToolActivity,
} from "@/lib/ai-response";
import {
  createClientEditTools,
  CLIENT_EDIT_SYSTEM_PROMPT,
} from "@/lib/ai-plugins/client-edit-tools";
import { PRODUCT } from "@/lib/product";
import { checkAiLimit, incrementAiUsage } from "@/lib/usage";
import { z } from "zod";

const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  activeFile: z.string().optional(),
  selectedText: z.string().optional(),
  action: z
    .enum([
      "chat",
      "explain-errors",
      "tighten",
      "rephrase",
      "improve",
      "shorten",
      "expand",
      "citation",
      "find-papers",
    ])
    .optional(),
  compileErrors: z
    .array(
      z.union([
        z.string(),
        z.object({
          message: z.string(),
          file: z.string().optional(),
          line: z.number().optional(),
        }),
      ])
    )
    .optional(),
});

type ChatRequest = z.infer<typeof chatSchema>;

type AiContextMode = "full" | "compile-fix" | "compile-fix-minimal";

const PROMPT_TOO_LARGE_MESSAGE =
  "The project context is too large for the AI service. Try asking about a specific file or selection.";

const COMPILE_FIX_CLIENT_EDIT_PROMPT = `Apply surgical LaTeX fixes with fix_compile_errors or apply_edit.
- Use exact search/replace from the snippets provided. Each search must match once.
- Only edit .tex files shown in context.
- Keep edits minimal. After tool calls, briefly explain fixes.`;

const WRITING_ACTION_PROMPTS: Record<string, string> = {
  tighten:
    "Tighten the selected text: remove redundancy and improve concision while preserving meaning and LaTeX syntax.",
  rephrase:
    "Rephrase the selected text for clarity while preserving meaning and LaTeX syntax. Return the revised passage.",
  improve:
    "Improve the selected text for clarity, flow, and academic tone while preserving meaning and LaTeX syntax.",
  shorten:
    "Shorten the selected text while preserving the key claims and LaTeX syntax.",
  expand:
    "Expand the selected text with useful detail and academic tone while keeping LaTeX syntax valid.",
  citation:
    "Suggest how to cite or reference the selected passage. Use search_literature when real papers are needed; never invent citations.",
  "explain-errors":
    "Fix the compile errors using fix_compile_errors or apply_edit with exact search/replace from the file context. Apply surgical LaTeX fixes, then explain what you changed.",
};

const FOLLOW_UP_SYSTEM_SUFFIX = `

The previous turn already ran tools and returned results in the conversation.
Write a helpful reply for the user using those tool results.
Do not call tools again.`;

function getLastUserMessage(messages: ChatRequest["messages"]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return messages[i].content;
  }
  return "";
}

function isCompileFixRequest(data: ChatRequest): boolean {
  if (data.action === "explain-errors") return true;
  return detectFixCompileIntent(getLastUserMessage(data.messages), data.action);
}

function buildSystemPrompt(options: {
  data: ChatRequest;
  compileErrors: AiCompileError[];
  fileContext: string;
  pluginSystemPrompt: string;
  mode: AiContextMode;
}): string {
  const { data, compileErrors, fileContext, pluginSystemPrompt, mode } = options;
  const compileFix = mode !== "full";

  let systemPrompt = compileFix
    ? `You are ${PRODUCT.aiAssistantName}, a LaTeX assistant.
Fix compile errors using fix_compile_errors or apply_edit with exact search/replace from the snippets below.
Be concise and precise. Explain what you changed after applying fixes.
${COMPILE_FIX_CLIENT_EDIT_PROMPT}`
    : `You are ${PRODUCT.aiAssistantName}, a helpful LaTeX assistant for academic writing.
You help researchers write, edit, and debug LaTeX documents.
Be concise and precise. When suggesting LaTeX code, use proper syntax and fenced \`\`\`latex blocks.
Format explanatory replies with markdown (headings, lists, tables) when helpful.
${CLIENT_EDIT_SYSTEM_PROMPT}`;

  if (!compileFix && pluginSystemPrompt) {
    systemPrompt += `\n${pluginSystemPrompt}`;
  }

  if (fileContext) {
    systemPrompt += compileFix
      ? `\n\n${fileContext}`
      : `\nCurrent project files:\n${fileContext}`;
  }

  if (compileFix && compileErrors.length > 0) {
    systemPrompt +=
      "\n\nWhen fixing errors, prefer fix_compile_errors or apply_edit with exact search/replace snippets from the file context.";
  } else if (data.action === "explain-errors" && compileErrors.length > 0) {
    systemPrompt += `\n\nThe user has compile errors:\n${compileErrors.map((error) => error.message).join("\n")}`;
    systemPrompt +=
      "\n\nWhen fixing errors, prefer fix_compile_errors or apply_edit with exact search/replace snippets from the file context.";
  }

  if (data.action) {
    const actionPrompt =
      getPluginActionPrompt(data.action) ?? WRITING_ACTION_PROMPTS[data.action];
    if (actionPrompt) {
      systemPrompt += `\n\n${actionPrompt}`;
    }
  }

  if (data.selectedText) {
    systemPrompt += `\n\nSelected text in ${data.activeFile || "editor"}:\n${data.selectedText}`;
  }

  return systemPrompt;
}

async function resolveAssistantContent<TOOLS extends ToolSet>(options: {
  result: GenerateTextResult<TOOLS, unknown>;
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const { result, model, systemPrompt, messages } = options;
  const trimmed = result.text.trim();
  if (trimmed) return result.text;

  if (!hadToolActivity(result)) {
    return "I couldn't generate a response. Please try again.";
  }

  const followUp = await generateText({
    model,
    system: `${systemPrompt}${FOLLOW_UP_SYSTEM_SUFFIX}`,
    messages: [...messages, ...result.response.messages],
    maxRetries: 0,
  });

  if (followUp.text.trim()) return followUp.text;

  const fallback = formatToolResultsAsAssistantMessage(result);
  if (fallback) return fallback;

  return "I searched but couldn't format the results. Please try asking again.";
}

function isAiPromptTooLargeError(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false;
  const msg = error.message.toLowerCase();
  if (error.statusCode === 413) return true;
  return (
    error.statusCode === 429 &&
    (msg.includes("too large") || msg.includes("tpm") || msg.includes("token"))
  );
}

function isAiRateLimitError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.statusCode === 429;
}

async function getAiConfig() {
  const env = readAiEnvFromProcess();

  if (config.isSelfHosted) {
    const [org] = await db.select().from(organization).limit(1);
    return resolveSelfHostedAiConfig(org, {
      ...env,
      fallbackOpenaiBaseUrl: config.openai.baseUrl,
      fallbackOpenaiModel: config.openai.model,
    });
  }

  return resolveHostedAiConfig(env);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const aiConfig = await getAiConfig();
  if (!aiConfig?.apiKey) {
    return NextResponse.json(
      { error: aiNotConfiguredMessage(config.isSelfHosted) },
      { status: 503 }
    );
  }

  const limit = await checkAiLimit(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.reason }, { status: 403 });
  }

  const body = await req.json();
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const requestData = parsed.data;

  const files = await db.select().from(projectFile).where(eq(projectFile.projectId, id));
  const texFiles = files
    .filter((f) => !f.isBinary && f.path.endsWith(".tex"))
    .map((f) => ({ path: f.path, content: f.content }));

  const compileErrors = normalizeAiCompileErrors(requestData.compileErrors);
  const compileFixRequest = isCompileFixRequest(requestData);

  const { tools: pluginTools, systemPrompt: pluginSystemPrompt, plugins } = resolveAiPlugins();

  const texFileMap = new Map(texFiles.map((f) => [f.path, f.content]));
  const hasSelection = Boolean(requestData.selectedText?.trim());

  const clientEditTools = createClientEditTools({
    texFiles: texFileMap,
    activeFile: requestData.activeFile,
    hasSelection,
  });

  const openai = createOpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseUrl,
  });

  const model = openai(aiConfig.model);

  async function runGenerateText(mode: AiContextMode) {
    const fileContext =
      mode === "full"
        ? buildAiFileContext(texFiles, {
            activeFile: requestData.activeFile,
          })
        : buildAiCompileFixContext({
            errors: compileErrors,
            files: texFiles,
            activeFile: requestData.activeFile,
            errorsOnly: mode === "compile-fix-minimal",
          });

    const systemPrompt = buildSystemPrompt({
      data: requestData,
      compileErrors,
      fileContext,
      pluginSystemPrompt,
      mode: compileFixRequest ? mode : "full",
    });

    const result = await generateText({
      model,
      system: systemPrompt,
      messages: requestData.messages,
      maxRetries: 0,
      maxSteps: 8,
      tools: compileFixRequest
        ? clientEditTools
        : { ...pluginTools, ...clientEditTools },
    });

    const content = await resolveAssistantContent({
      result,
      model,
      systemPrompt,
      messages: requestData.messages,
    });

    return { result, content, systemPrompt };
  }

  try {
    const initialMode: AiContextMode = compileFixRequest ? "compile-fix" : "full";
    let generation = await runGenerateText(initialMode);

    const usedPlugins = collectUsedPlugins(generation.result, plugins);
    const papers = collectPapersFromToolResults(generation.result);
    const actions = collectClientActionsFromToolResults(generation.result);
    const appliedActions = toAppliedActionSummaries(actions);

    await incrementAiUsage(session.user.id);

    return NextResponse.json({
      content: generation.content,
      ...(usedPlugins.length > 0 ? { usedPlugins } : {}),
      ...(papers.length > 0 ? { papers } : {}),
      ...(actions.length > 0 ? { actions, appliedActions } : {}),
    });
  } catch (error) {
    if (compileFixRequest && isAiPromptTooLargeError(error)) {
      try {
        const retry = await runGenerateText("compile-fix-minimal");
        const actions = collectClientActionsFromToolResults(retry.result);
        const appliedActions = toAppliedActionSummaries(actions);

        await incrementAiUsage(session.user.id);

        return NextResponse.json({
          content: retry.content,
          ...(actions.length > 0 ? { actions, appliedActions } : {}),
        });
      } catch (retryError) {
        if (isAiPromptTooLargeError(retryError)) {
          return NextResponse.json({ error: PROMPT_TOO_LARGE_MESSAGE }, { status: 429 });
        }
        console.error("AI compile-fix retry failed:", retryError);
        const message =
          APICallError.isInstance(retryError) && retryError.message
            ? retryError.message
            : "AI request failed. Please try again.";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }

    if (isAiPromptTooLargeError(error)) {
      return NextResponse.json({ error: PROMPT_TOO_LARGE_MESSAGE }, { status: 429 });
    }
    if (isAiRateLimitError(error)) {
      return NextResponse.json(
        { error: "AI service rate limit reached. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    console.error("AI request failed:", error);
    const message =
      APICallError.isInstance(error) && error.message
        ? error.message
        : "AI request failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
