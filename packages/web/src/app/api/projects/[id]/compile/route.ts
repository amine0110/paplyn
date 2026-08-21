import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectFile, compileLog } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { config } from "@/lib/config";
import { checkCompileLimit, incrementCompileUsage } from "@/lib/usage";
import { generateId } from "@/lib/utils";
import { createProjectRevision } from "@/lib/project-revisions-store";

interface CompileError {
  line?: number;
  file?: string;
  message: string;
  severity: "error" | "warning";
}

interface CompileResult {
  success: boolean;
  pdf?: string;
  log: string;
  errors: CompileError[];
  durationMs: number;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limit = await checkCompileLimit(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.reason }, { status: 403 });
  }

  const files = await db.select().from(projectFile).where(eq(projectFile.projectId, id));

  try {
    const response = await fetch(`${config.compilerUrl}/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mainFile: access.project.mainFile,
        engine: access.project.compiler,
        files: files.map((f) => ({
          path: f.path,
          content: f.content,
        })),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json({ error: err.error || "Compile service error" }, { status: 502 });
    }

    const result = (await response.json()) as CompileResult;

    await incrementCompileUsage(session.user.id);

    await db.insert(compileLog).values({
      id: generateId(),
      projectId: id,
      userId: session.user.id,
      success: result.success,
      durationMs: result.durationMs,
      errorCount: result.errors.filter((e) => e.severity === "error").length,
    });

    if (result.success) {
      await createProjectRevision({
        projectId: id,
        userId: session.user.id,
        source: "compile",
        pdf: result.pdf ?? null,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach compile service" },
      { status: 502 }
    );
  }
}
