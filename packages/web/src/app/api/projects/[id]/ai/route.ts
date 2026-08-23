import { NextRequest, NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, APICallError, type GenerateTextResult, type ToolSet } from "ai";
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
  selectCompileFixMessages,
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
  createWorkspaceTools,
  WORKSPACE_SYSTEM_PROMPT,
  COMPILE_FIX_WORKSPACE_SUFFIX,
} from "@/lib/ai-plugins/workspace-tools";
import {
  AI_RATE_LIMIT_MESSAGE,
  formatAiRequestError,
  getRetryAfterSeconds,
  isAiPromptTooLargeError,
  isAiRateLimitError,
  isSlimCompileFixPrompt,
  isUnknownToolCallError,
  logAiApiError,
  PROMPT_TOO_LARGE_MESSAGE,
  shouldTreatCompileFix429AsRateLimit,
  UNKNOWN_TOOL_RETRY_HINT,
} from "@/lib/ai-tool-errors";
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
          severity: z.enum(["error", "warning"]).optional(),
        }),
      ])
    )
    .optional(),
});

type ChatRequest = z.infer<typeof chatSchema>;

type AiContextMode = "full" | "compile-fix" | "compile-fix-minimal";

type CompileFixMetrics = {
  mode: AiContextMode;
  systemPromptChars: number;
  messagesChars: number;
  errorCount: number;
};

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
    "Fix the compile errors using get_file to read small line ranges, then fix_compile_errors or apply_edit with exact search/replace. Apply surgical LaTeX fixes, then explain what you changed.",
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
  retryHint?: string;
}): string {
  const { data, compileErrors, fileContext, pluginSystemPrompt, mode, retryHint } = options;
  const compileFix = mode !== "full";

  let systemPrompt = compileFix
    ? `You are ${PRODUCT.aiAssistantName}, a LaTeX assistant for academic writing.
Be concise and precise. When suggesting LaTeX code, use proper syntax and fenced \`\`\`latex blocks.
Format explanatory replies with markdown (headings, lists, tables) when helpful.
${WORKSPACE_SYSTEM_PROMPT}
${COMPILE_FIX_WORKSPACE_SUFFIX}`
    : `You are ${PRODUCT.aiAssistantName}, a helpful LaTeX assistant for academic writing.
You help researchers write, edit, and debug LaTeX documents.
Be concise and precise. When suggesting LaTeX code, use proper syntax and fenced \`\`\`latex blocks.
Format explanatory replies with markdown (headings, lists, tables) when helpful.
${WORKSPACE_SYSTEM_PROMPT}`;

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
      "\n\nWhen fixing errors, call get_file for small line ranges around cited lines, then fix_compile_errors or apply_edit with exact search/replace from the returned content.";
  }

  if (data.action) {
    const actionPrompt =
      getPluginActionPrompt(data.action) ?? WRITING_ACTION_PROMPTS[data.action];
    if (actionPrompt) {
      systemPrompt += `\n\n${actionPrompt}`;
    }
  }

  if (!compileFix && data.selectedText) {
    systemPrompt += `\n\nSelected text in ${data.activeFile || "editor"}:\n${data.selectedText}`;
  }

  if (retryHint) {
    systemPrompt += `\n\n${retryHint}`;
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

function rateLimitResponse(error: unknown): NextResponse {
  const headers = new Headers();
  const retryAfter = getRetryAfterSeconds(error);
  if (retryAfter != null) {
    headers.set("Retry-After", String(retryAfter));
  }
  return NextResponse.json({ error: AI_RATE_LIMIT_MESSAGE }, { status: 429, headers });
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

  const workspaceTools = createWorkspaceTools({
    texFiles: texFileMap,
    activeFile: requestData.activeFile,
    hasSelection,
  });

  const openai = createOpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseUrl,
  });

  const model = openai(aiConfig.model);

  const compileFixMetricsRef: { current: CompileFixMetrics | null } = { current: null };

  async function runGenerateText(mode: AiContextMode, options?: { retryHint?: string }) {
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

    const messages = compileFixRequest
      ? selectCompileFixMessages(requestData.messages)
      : requestData.messages;

    const systemPrompt = buildSystemPrompt({
      data: requestData,
      compileErrors,
      fileContext,
      pluginSystemPrompt,
      mode: compileFixRequest ? mode : "full",
      retryHint: options?.retryHint,
    });

    if (compileFixRequest) {
      const messagesChars = messages.reduce((sum, message) => sum + message.content.length, 0);
      compileFixMetricsRef.current = {
        mode,
        systemPromptChars: systemPrompt.length,
        messagesChars,
        errorCount: compileErrors.length,
      };
      console.info("[ai compile-fix]", {
        mode,
        systemPromptChars: systemPrompt.length,
        messagesChars,
        messageCount: messages.length,
        errorCount: compileErrors.length,
        fileContextLength: fileContext.length,
        slim: isSlimCompileFixPrompt(systemPrompt.length, messagesChars),
      });
    }

    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      maxRetries: 0,
      maxSteps: compileFixRequest ? 4 : 8,
      tools: compileFixRequest
        ? workspaceTools
        : { ...pluginTools, ...workspaceTools },
    });

    const content = await resolveAssistantContent({
      result,
      model,
      systemPrompt,
      messages,
    });

    return { result, content, systemPrompt };
  }

  const initialMode: AiContextMode = compileFixRequest ? "compile-fix-minimal" : "full";

  try {
    const generation = await runGenerateText(initialMode);

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
    const compileFixMetrics = compileFixMetricsRef.current;
    if (compileFixMetrics) {
      logAiApiError(
        {
          compileFix: true,
          mode: compileFixMetrics.mode,
          systemPromptChars: compileFixMetrics.systemPromptChars,
          messagesChars: compileFixMetrics.messagesChars,
          errorCount: compileFixMetrics.errorCount,
        },
        error
      );
    } else if (APICallError.isInstance(error)) {
      logAiApiError({ compileFix: false }, error);
    }

    if (isUnknownToolCallError(error)) {
      try {
        const retry = await runGenerateText(initialMode, {
          retryHint: UNKNOWN_TOOL_RETRY_HINT,
        });
        const actions = collectClientActionsFromToolResults(retry.result);
        const appliedActions = toAppliedActionSummaries(actions);

        await incrementAiUsage(session.user.id);

        return NextResponse.json({
          content: retry.content,
          ...(actions.length > 0 ? { actions, appliedActions } : {}),
        });
      } catch (retryError) {
        console.error("AI unknown-tool retry failed:", retryError);
        return NextResponse.json(
          { error: formatAiRequestError(retryError) },
          { status: 502 }
        );
      }
    }

    if (isAiRateLimitError(error)) {
      return rateLimitResponse(error);
    }
    if (
      compileFixMetrics &&
      shouldTreatCompileFix429AsRateLimit(
        error,
        compileFixMetrics.systemPromptChars,
        compileFixMetrics.messagesChars
      )
    ) {
      return rateLimitResponse(error);
    }
    if (isAiPromptTooLargeError(error)) {
      return NextResponse.json({ error: PROMPT_TOO_LARGE_MESSAGE }, { status: 429 });
    }
    console.error("AI request failed:", error);
    return NextResponse.json({ error: formatAiRequestError(error) }, { status: 502 });
  }
}
