import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { project, projectFile } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { generateId } from "@/lib/utils";
import { checkProjectLimit } from "@/lib/usage";
import { GitHubImportError, importPublicGitHubRepo } from "@/lib/github-import";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  repo: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkProjectLimit(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.reason }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Project name and repository are required" }, { status: 400 });
  }

  const name = parsed.data.name.trim();
  if (!name) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  try {
    const imported = await importPublicGitHubRepo(parsed.data.repo);
    const projectId = generateId();

    await db.insert(project).values({
      id: projectId,
      name,
      ownerId: session.user.id,
      mainFile: imported.mainFile,
      compiler: "pdflatex",
      template: null,
    });

    for (const file of imported.files) {
      await db.insert(projectFile).values({
        id: generateId(),
        projectId,
        path: file.path,
        content: file.content,
        isBinary: file.isBinary ?? false,
      });
    }

    const [created] = await db.select().from(project).where(eq(project.id, projectId)).limit(1);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof GitHubImportError ? error.message : "Failed to import GitHub repository";
    const status = error instanceof GitHubImportError && error.status ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
