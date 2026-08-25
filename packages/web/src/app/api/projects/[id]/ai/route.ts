import { NextRequest, NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import {
  streamText,
  APICallError,
  type GenerateTextResult,
  type StepResult,
  type StreamTextResult,
  type ToolSet,
} from "ai";
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
  buildCompileFixTargetHint,
  buildCompileFixMultiErrorHint,
  COMPILE_FIX_MAX_GET_FILE_CALLS,
  normalizeAiCompileErrors,
  prepareCompileErrorsForCompileFix,
  selectCompileFixMessages,
  type AiCompileError,
} from "@/lib/ai-compile-fix-context";
import { formatCompileFixLineChangeSummary } from "@/lib/ai-compile-fix-validation";
import { buildCompileFixNoEditMessage } from "@/lib/ai-compile-fix-failure";
import { detectFixCompileIntent } from "@/lib/ai-compile-fix-intent";
import { getForcedToolPrompt, getPluginActionPrompt, isRegisteredPluginToolName, resolveAiPlugins } from "@/lib/ai-plugins";
import {
  asPluginToolsRecord,
  resolveForcedToolChoice,
} from "@/lib/ai-plugins/forced-tool";
import {
  collectArxivPapersFromToolResults,
  collectDoiCitationsFromToolResults,
  collectPapersFromToolResults,
  collectUsedPlugins,
  collectClientActionsFromToolResults,
  collectToolReadChips,
  toAppliedActionSummaries,
  formatToolResultsAsAssistantMessage,
  formatAppliedActionsAsAssistantMessage,
  resolveEmptyAssistantFallback,
  hadReadOnlyToolActivity,
  hadToolActivity,
  NO_EDIT_FALLBACK_MESSAGE,
  usedClientEditTools,
} from "@/lib/ai-response";
import {
  createWorkspaceTools,
  WORKSPACE_SYSTEM_PROMPT,
  WORKSPACE_CHAT_SUFFIX,
  COMPILE_FIX_WORKSPACE_SUFFIX,
} from "@/lib/ai-plugins/workspace-tools";
import {
  AI_RATE_LIMIT_MESSAGE,
  formatAiRequestError,
  getRetryAfterSeconds,
  isAiPromptTooLargeError,
  isAiRateLimitError,
  isSlimCompileFixPrompt,
  isToolChoiceNoneViolationError,
  isUnknownToolCallError,
  logAiApiError,
  PROMPT_TOO_LARGE_MESSAGE,
  shouldTreatCompileFix429AsRateLimit,
  TOOL_CHOICE_NONE_RETRY_HINT,
  UNKNOWN_TOOL_RETRY_HINT,
} from "@/lib/ai-tool-errors";
import {
  AI_STREAM_CONTENT_TYPE,
  encodeAiStreamEvent,
  type AiStreamDoneEvent,
} from "@/lib/ai-stream";
import {
  formatToolProgressDone,
  formatToolProgressStart,
} from "@/lib/ai-tool-progress";
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
      "correct",
      "write",
    ])
    .optional(),
  /** When set, the user picked a plugin tool in the composer — force that tool call. */
  forcedTool: z.string().optional(),
  /** Inline selection bubble — require replace_selection, not file-wide edits. */
  inlineSelection: z.boolean().optional(),
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

type GetFileCall = { path: string; startLine: number; endLine: number };

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
  correct:
    "Correct spelling and orthography in the selected text only. Keep meaning and tone — do not rephrase or rewrite.",
  write:
    "Follow the user's instruction for the selected text. Replace the selection with the result while keeping valid LaTeX syntax.",
  citation:
    "Suggest how to cite or reference the selected passage. Use search_literature when real papers are needed; never invent citations.",
  "explain-errors":
    "Fix the compile errors using get_file to read small line ranges, then replace_lines (when errors cite a line number), fix_compile_errors, or apply_edit. Prefer replace_lines for cited line numbers in large templates. Apply surgical LaTeX fixes, then explain what you changed.",
};

const INLINE_SELECTION_SUFFIX =
  "The user selected text in the editor. You MUST call replace_selection with the full replacement text for that exact selection. Do NOT use insert_at_cursor, apply_edit, or replace_lines on other spans. Do NOT leave the original selection in the document — replace it in place. Return only the replacement LaTeX in replace_selection (no duplicate of the old text).";

const SELECTION_REPLACE_SUFFIX =
  "The user has selected text in the editor. When rewriting the selection, call replace_selection with the replacement text. Do not insert above or below the selection.";

const COMPILE_FIX_MAX_STEPS = 12;
const CHAT_MAX_STEPS = 10;

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
  compileFixTargetHint?: string;
  compileFixMultiErrorHint?: string;
}): string {
  const {
    data,
    compileErrors,
    fileContext,
    pluginSystemPrompt,
    mode,
    retryHint,
    compileFixTargetHint,
    compileFixMultiErrorHint,
  } = options;
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

  if (!compileFix) {
    systemPrompt += `\n\n${WORKSPACE_CHAT_SUFFIX}`;
  }

  if (fileContext) {
    systemPrompt += compileFix
      ? `\n\n${fileContext}`
      : `\nCurrent project files:\n${fileContext}`;
  }

  if (compileFix && compileErrors.length > 0) {
    systemPrompt +=
      "\n\nWhen fixing errors, call get_file for small line ranges around cited lines. Prefer replace_lines when errors cite a line number — large templates often have no unique apply_edit substrings. Use fix_compile_errors or apply_edit only when search matches exactly once. If apply_edit is rejected, use replace_lines for the cited line range.";
  }

  if (compileFixTargetHint) {
    systemPrompt += `\n\n${compileFixTargetHint}`;
  }

  if (compileFixMultiErrorHint) {
    systemPrompt += `\n\n${compileFixMultiErrorHint}`;
  }

  if (data.action) {
    const actionPrompt =
      getPluginActionPrompt(data.action) ?? WRITING_ACTION_PROMPTS[data.action];
    if (actionPrompt) {
      systemPrompt += `\n\n${actionPrompt}`;
    }
  }

  if (data.forcedTool && isRegisteredPluginToolName(data.forcedTool)) {
    const forcedPrompt = getForcedToolPrompt(data.forcedTool);
    if (forcedPrompt) {
      systemPrompt += `\n\n${forcedPrompt}`;
    }
  }

  if (!compileFix && data.selectedText) {
    systemPrompt += `\n\nSelected text in ${data.activeFile || "editor"}:\n${data.selectedText}`;
    if (data.inlineSelection) {
      systemPrompt += `\n\n${INLINE_SELECTION_SUFFIX}`;
    } else {
      systemPrompt += `\n\n${SELECTION_REPLACE_SUFFIX}`;
    }
  }

  if (retryHint) {
    systemPrompt += `\n\n${retryHint}`;
  }

  return systemPrompt;
}

async function toGenerateTextResult<TOOLS extends ToolSet>(
  streamResult: StreamTextResult<TOOLS, unknown>
): Promise<GenerateTextResult<TOOLS, unknown>> {
  const [text, steps] = await Promise.all([streamResult.text, streamResult.steps]);
  const toolCalls = steps.flatMap((step) => step.toolCalls);
  const toolResults = steps.flatMap((step) => step.toolResults);

  return {
    text,
    toolCalls,
    toolResults,
    steps,
    finishReason: steps.at(-1)?.finishReason ?? "stop",
    usage: steps.reduce(
      (acc, step) => ({
        promptTokens: (acc.promptTokens ?? 0) + (step.usage?.promptTokens ?? 0),
        completionTokens: (acc.completionTokens ?? 0) + (step.usage?.completionTokens ?? 0),
        totalTokens: (acc.totalTokens ?? 0) + (step.usage?.totalTokens ?? 0),
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    ),
    warnings: await streamResult.warnings,
    request: await streamResult.request,
    response: await streamResult.response,
    experimental_providerMetadata: undefined,
    providerMetadata: undefined,
    logprobs: undefined,
    reasoning: undefined,
    reasoningDetails: await streamResult.reasoningDetails,
    sources: [],
    files: [],
  } as unknown as GenerateTextResult<TOOLS, unknown>;
}

async function resolveAssistantContent<TOOLS extends ToolSet>(options: {
  result: GenerateTextResult<TOOLS, unknown>;
  compileFixRequest: boolean;
  compileErrors: AiCompileError[];
  getFileCalls: GetFileCall[];
}): Promise<string> {
  const { result, compileFixRequest, compileErrors, getFileCalls } = options;
  const trimmed = result.text.trim();
  const actions = collectClientActionsFromToolResults(result);

  if (compileFixRequest && !usedClientEditTools(result)) {
    return buildCompileFixNoEditMessage({
      errors: compileErrors,
      getFileCalls,
      steps: result.steps as StepResult<ToolSet>[],
    });
  }

  const lineSummaries = actions
    .flatMap((action) => {
      if (action.type === "replace_lines") {
        return [
          formatCompileFixLineChangeSummary({
            file: action.file,
            startLine: action.startLine,
            endLine: action.endLine,
          }),
        ];
      }
      return [];
    })
    .filter((summary, index, all) => all.indexOf(summary) === index);

  if (compileFixRequest && lineSummaries.length > 0) {
    const changeBlock = lineSummaries.join(" ");
    if (trimmed) {
      const hasLineRef = lineSummaries.some((summary) => trimmed.includes(summary));
      return hasLineRef ? result.text : `${changeBlock}\n\n${result.text}`;
    }
    return changeBlock;
  }

  if (trimmed) return result.text;

  if (!compileFixRequest) {
    return resolveEmptyAssistantFallback({ result, actions });
  }

  if (!hadToolActivity(result)) {
    return "I couldn't generate a response. Please try again.";
  }

  const appliedSummary = formatAppliedActionsAsAssistantMessage(actions);
  if (appliedSummary) return appliedSummary;

  if (compileFixRequest && usedClientEditTools(result) && actions.length === 0) {
    return buildCompileFixNoEditMessage({
      errors: compileErrors,
      getFileCalls,
      steps: result.steps as StepResult<ToolSet>[],
    });
  }

  const fallback = formatToolResultsAsAssistantMessage(result);
  if (fallback) return fallback;

  if (usedClientEditTools(result)) {
    return "I applied the suggested edits. Recompile to check whether the errors are resolved.";
  }

  if (hadReadOnlyToolActivity(result)) {
    return NO_EDIT_FALLBACK_MESSAGE;
  }

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

  const compileErrorsRaw = normalizeAiCompileErrors(requestData.compileErrors);
  const compileFixRequest = isCompileFixRequest(requestData);

  const { tools: pluginTools, systemPrompt: pluginSystemPrompt, plugins } = resolveAiPlugins();

  const texFileMap = new Map(texFiles.map((f) => [f.path, f.content]));
  const mainFile = access.project.mainFile;
  const mainFileContent = texFileMap.get(mainFile) ?? "";

  const compileFixErrorPrep = compileFixRequest
    ? prepareCompileErrorsForCompileFix(compileErrorsRaw, {
        mainFile,
        mainFileContent,
      })
    : null;
  const compileErrors = compileFixErrorPrep?.errors ?? compileErrorsRaw;
  const primaryErrorLocation = compileFixErrorPrep?.primaryLocation ?? null;
  const hasSelection = Boolean(requestData.selectedText?.trim());
  const getFileCalls: GetFileCall[] = [];

  const workspaceCtx = {
    texFiles: texFileMap,
    activeFile: requestData.activeFile,
    hasSelection,
  };

  async function refreshTexFilesFromDb(): Promise<Map<string, string>> {
    const freshFiles = await db
      .select()
      .from(projectFile)
      .where(eq(projectFile.projectId, id));
    const freshTex = freshFiles
      .filter((f) => !f.isBinary && f.path.endsWith(".tex"))
      .map((f) => ({ path: f.path, content: f.content }));
    texFileMap.clear();
    for (const file of freshTex) {
      texFileMap.set(file.path, file.content);
    }
    return texFileMap;
  }

  const workspaceTools = createWorkspaceTools(
    workspaceCtx,
    compileFixRequest
      ? {
          maxGetFileCalls: COMPILE_FIX_MAX_GET_FILE_CALLS,
          compileFix: true,
          citedErrorLocation: primaryErrorLocation,
          refreshTexFiles: refreshTexFilesFromDb,
          onGetFileCall: (call) => {
            getFileCalls.push(call);
          },
        }
      : {}
  );

  const openai = createOpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseUrl,
  });

  const model = openai(aiConfig.model);

  const compileFixMetricsRef: { current: CompileFixMetrics | null } = { current: null };

  async function runStreamText(mode: AiContextMode, options?: { retryHint?: string }) {
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

    const compileFixTargetHint =
      compileFixRequest && primaryErrorLocation
        ? buildCompileFixTargetHint(primaryErrorLocation)
        : undefined;

    const compileFixMultiErrorHint =
      compileFixRequest && compileErrors.length > 1
        ? buildCompileFixMultiErrorHint(compileErrors)
        : undefined;

    const systemPrompt = buildSystemPrompt({
      data: requestData,
      compileErrors,
      fileContext,
      pluginSystemPrompt,
      mode: compileFixRequest ? mode : "full",
      retryHint: options?.retryHint,
      compileFixTargetHint,
      compileFixMultiErrorHint,
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
        primaryErrorLocation,
      });
    }

    const lastUserMessage = getLastUserMessage(requestData.messages);
    const pluginToolsRecord = !compileFixRequest ? asPluginToolsRecord(pluginTools) : null;
    const forcedToolName = pluginToolsRecord
      ? resolveForcedToolChoice({
          forcedTool: requestData.forcedTool,
          userMessage: lastUserMessage,
          pluginTools: pluginToolsRecord,
        })
      : undefined;

    const streamResult = compileFixRequest
      ? streamText({
          model,
          system: systemPrompt,
          messages,
          maxRetries: 0,
          maxSteps: COMPILE_FIX_MAX_STEPS,
          tools: workspaceTools,
        })
      : forcedToolName && pluginToolsRecord
        ? streamText({
            model,
            system: systemPrompt,
            messages,
            maxRetries: 0,
            maxSteps: CHAT_MAX_STEPS,
            tools: { ...pluginToolsRecord, ...workspaceTools },
            toolChoice: { type: "tool", toolName: forcedToolName },
          })
        : streamText({
            model,
            system: systemPrompt,
            messages,
            maxRetries: 0,
            maxSteps: CHAT_MAX_STEPS,
            tools: { ...pluginTools, ...workspaceTools },
          });

    return { streamResult, systemPrompt };
  }

  const initialMode: AiContextMode = compileFixRequest ? "compile-fix-minimal" : "full";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const emit = (event: Parameters<typeof encodeAiStreamEvent>[0]) => {
        controller.enqueue(encodeAiStreamEvent(event));
      };

      const emitProgress = (message: string) => {
        emit({ type: "progress", message });
      };

      const runOnce = async (retryHint?: string) => {
        const { streamResult } = await runStreamText(initialMode, { retryHint });

        for await (const part of streamResult.fullStream) {
          if (part.type === "tool-call") {
            const args =
              typeof part.args === "object" && part.args !== null
                ? (part.args as Record<string, unknown>)
                : {};
            const startMessage = formatToolProgressStart(part.toolName, args);
            if (startMessage) emitProgress(startMessage);
          }

          if (part.type === "tool-result") {
            const doneMessage = formatToolProgressDone(part.toolName, part.result);
            if (doneMessage) emitProgress(doneMessage);
          }
        }

        const result = await toGenerateTextResult(streamResult);
        const content = await resolveAssistantContent({
          result,
          compileFixRequest,
          compileErrors,
          getFileCalls,
        });

        const usedPlugins = collectUsedPlugins(result, plugins);
        const papers = collectPapersFromToolResults(result);
        const doiCitations = collectDoiCitationsFromToolResults(result);
        const arxivPapers = collectArxivPapersFromToolResults(result);
        const actions = collectClientActionsFromToolResults(result);
        const appliedActions = toAppliedActionSummaries(actions);
        const toolReads = collectToolReadChips(result);

        await incrementAiUsage(session.user.id);

        const doneEvent: AiStreamDoneEvent = {
          type: "done",
          content,
          ...(usedPlugins.length > 0 ? { usedPlugins } : {}),
          ...(papers.length > 0 ? { papers } : {}),
          ...(doiCitations.length > 0 ? { doiCitations } : {}),
          ...(arxivPapers.length > 0 ? { arxivPapers } : {}),
          ...(actions.length > 0 ? { actions, appliedActions } : {}),
          ...(toolReads.length > 0 ? { toolReads } : {}),
        };
        emit(doneEvent);
      };

      try {
        await runOnce();
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

        if (isToolChoiceNoneViolationError(error)) {
          try {
            emitProgress("Retrying with tools enabled…");
            await runOnce(TOOL_CHOICE_NONE_RETRY_HINT);
            return;
          } catch (retryError) {
            console.error("AI tool-choice-none retry failed:", retryError);
            emit({
              type: "error",
              error: formatAiRequestError(retryError),
              status: 502,
            });
            return;
          }
        }

        if (isUnknownToolCallError(error)) {
          try {
            emitProgress("Retrying with valid tools…");
            await runOnce(UNKNOWN_TOOL_RETRY_HINT);
            return;
          } catch (retryError) {
            console.error("AI unknown-tool retry failed:", retryError);
            emit({
              type: "error",
              error: formatAiRequestError(retryError),
              status: 502,
            });
            return;
          }
        }

        if (isAiRateLimitError(error)) {
          const retryAfter = getRetryAfterSeconds(error);
          emit({
            type: "error",
            error: AI_RATE_LIMIT_MESSAGE,
            status: 429,
            ...(retryAfter != null ? { retryAfter } : {}),
          });
          return;
        }

        if (
          compileFixMetrics &&
          shouldTreatCompileFix429AsRateLimit(
            error,
            compileFixMetrics.systemPromptChars,
            compileFixMetrics.messagesChars
          )
        ) {
          const retryAfter = getRetryAfterSeconds(error);
          emit({
            type: "error",
            error: AI_RATE_LIMIT_MESSAGE,
            status: 429,
            ...(retryAfter != null ? { retryAfter } : {}),
          });
          return;
        }

        if (isAiPromptTooLargeError(error)) {
          emit({
            type: "error",
            error: PROMPT_TOO_LARGE_MESSAGE,
            status: 429,
          });
          return;
        }

        console.error("AI request failed:", error);
        emit({
          type: "error",
          error: formatAiRequestError(error),
          status: 502,
        });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": AI_STREAM_CONTENT_TYPE,
      "Cache-Control": "no-cache",
    },
  });
}
