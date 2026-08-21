import { NextRequest, NextResponse } from "next/server";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectFile, organization } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { config } from "@/lib/config";
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
  action: z.enum(["chat", "explain-errors", "tighten", "citation"]).optional(),
  compileErrors: z.array(z.string()).optional(),
});

async function getAiConfig() {
  if (config.isSelfHosted) {
    const [org] = await db.select().from(organization).limit(1);
    if (org?.openaiApiKey) {
      return {
        apiKey: org.openaiApiKey,
        baseUrl: org.openaiBaseUrl || config.openai.baseUrl,
        model: org.openaiModel || config.openai.model,
      };
    }
  }

  if (config.openai.apiKey) {
    return config.openai;
  }

  return null;
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
      { error: "AI not configured. Set OPENAI_API_KEY in environment or admin settings." },
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
  const fileContext = files
    .filter((f) => !f.isBinary && f.path.endsWith(".tex"))
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  let systemPrompt = `You are ${PRODUCT.aiAssistantName}, a helpful LaTeX assistant for academic writing.
You help researchers write, edit, and debug LaTeX documents.
Be concise and precise. When suggesting LaTeX code, use proper syntax.
Current project files:\n${fileContext}`;

  if (parsed.data.action === "explain-errors" && parsed.data.compileErrors) {
    systemPrompt += `\n\nThe user has compile errors:\n${parsed.data.compileErrors.join("\n")}`;
  }

  if (parsed.data.selectedText) {
    systemPrompt += `\n\nSelected text in ${parsed.data.activeFile || "editor"}:\n${parsed.data.selectedText}`;
  }

  const openai = createOpenAI({
    apiKey: aiConfig.apiKey,
    baseURL: aiConfig.baseUrl,
  });

  await incrementAiUsage(session.user.id);

  const result = await generateText({
    model: openai(aiConfig.model),
    system: systemPrompt,
    messages: parsed.data.messages,
  });

  return NextResponse.json({ content: result.text });
}
