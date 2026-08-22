import { NextRequest, NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, generateText } from "ai";
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
import { getPluginActionPrompt, resolveAiPlugins } from "@/lib/ai-plugins";
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
  action: z.enum(["chat", "explain-errors", "tighten", "citation", "find-papers"]).optional(),
  compileErrors: z.array(z.string()).optional(),
});

const PROMPT_TOO_LARGE_MESSAGE =
  "The project context is too large for the AI service. Try asking about a specific file or selection.";

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

  const files = await db.select().from(projectFile).where(eq(projectFile.projectId, id));
  const texFiles = files
    .filter((f) => !f.isBinary && f.path.endsWith(".tex"))
    .map((f) => ({ path: f.path, content: f.content }));

  const fileContext = buildAiFileContext(texFiles, {
    activeFile: parsed.data.activeFile,
  });

  const { tools: pluginTools, systemPrompt: pluginSystemPrompt } = resolveAiPlugins();

  let systemPrompt = `You are ${PRODUCT.aiAssistantName}, a helpful LaTeX assistant for academic writing.
You help researchers write, edit, and debug LaTeX documents.
Be concise and precise. When suggesting LaTeX code, use proper syntax and fenced \`\`\`latex blocks.
Format explanatory replies with markdown (headings, lists, tables) when helpful.`;

  if (pluginSystemPrompt) {
    systemPrompt += `\n${pluginSystemPrompt}`;
  }

  if (fileContext) {
    systemPrompt += `\nCurrent project files:\n${fileContext}`;
  }

  if (parsed.data.action === "explain-errors" && parsed.data.compileErrors) {
    systemPrompt += `\n\nThe user has compile errors:\n${parsed.data.compileErrors.join("\n")}`;
  }

  if (parsed.data.action) {
    const actionPrompt = getPluginActionPrompt(parsed.data.action);
    if (actionPrompt) {
      systemPrompt += `\n\n${actionPrompt}`;
    }
  }

  if (parsed.data.selectedText) {
    systemPrompt += `\n\nSelected text in ${parsed.data.activeFile || "editor"}:\n${parsed.data.selectedText}`;
  }

  const openai = createOpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseUrl,
  });

  try {
    const result = await generateText({
      model: openai(aiConfig.model),
      system: systemPrompt,
      messages: parsed.data.messages,
      maxRetries: 0,
      maxSteps: 3,
      tools: pluginTools,
    });

    await incrementAiUsage(session.user.id);

    return NextResponse.json({ content: result.text });
  } catch (error) {
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
