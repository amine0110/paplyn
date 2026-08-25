import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { projectFile } from "@/lib/schema";
import { getProjectAccess } from "@/lib/project-access";
import { getSession } from "@/lib/session";
import { generateId } from "@/lib/utils";
import { ArxivError, fetchArxivPdf, fetchArxivSource, normalizeArxivId } from "@/lib/arxiv";

const bodySchema = z.object({
  arxivId: z.string().min(1),
  attachPdf: z.boolean().optional().default(true),
  importSource: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "arxivId is required" }, { status: 400 });
  }

  const arxivId = normalizeArxivId(parsed.data.arxivId);
  if (!arxivId) {
    return NextResponse.json({ error: "Invalid arXiv ID" }, { status: 400 });
  }

  try {
    const imported: { path: string }[] = [];

    if (parsed.data.attachPdf) {
      const pdf = await fetchArxivPdf(arxivId);
      await upsertProjectFile(id, pdf.path, pdf.content, pdf.isBinary ?? true);
      imported.push({ path: pdf.path });
    }

    if (parsed.data.importSource) {
      const sourceFiles = await fetchArxivSource(arxivId);
      for (const file of sourceFiles) {
        await upsertProjectFile(id, file.path, file.content, file.isBinary ?? false);
        imported.push({ path: file.path });
      }
    }

    if (imported.length === 0) {
      return NextResponse.json(
        { error: "Choose attachPdf and/or importSource" },
        { status: 400 }
      );
    }

    return NextResponse.json({ arxivId, imported });
  } catch (error) {
    const message = error instanceof ArxivError ? error.message : "Failed to import from arXiv";
    const status = error instanceof ArxivError && error.status ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

async function upsertProjectFile(
  projectId: string,
  path: string,
  content: string,
  isBinary: boolean
) {
  const existing = await db
    .select()
    .from(projectFile)
    .where(eq(projectFile.projectId, projectId))
    .then((rows) => rows.find((row) => row.path === path));

  if (existing) {
    await db
      .update(projectFile)
      .set({ content, isBinary, updatedAt: new Date() })
      .where(eq(projectFile.id, existing.id));
    return;
  }

  await db.insert(projectFile).values({
    id: generateId(),
    projectId,
    path,
    content,
    isBinary,
  });
}
