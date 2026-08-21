import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { project, projectFile } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { generateId } from "@/lib/utils";
import {
  buildRenameMap,
  folderPlaceholderPath,
  normalizePath,
  pathsUnderPrefix,
  resolveMainFileAfterRename,
} from "@/lib/project-files";
import { z } from "zod";

const fileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  isBinary: z.boolean().optional(),
});

const renameSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const files = await db.select().from(projectFile).where(eq(projectFile.projectId, id));
  return NextResponse.json(files);
}

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

  const body = await req.json();
  const parsed = fileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(projectFile)
    .where(and(eq(projectFile.projectId, id), eq(projectFile.path, parsed.data.path)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(projectFile)
      .set({
        content: parsed.data.content,
        isBinary: parsed.data.isBinary ?? false,
        updatedAt: new Date(),
      })
      .where(eq(projectFile.id, existing[0].id))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db
    .insert(projectFile)
    .values({
      id: generateId(),
      projectId: id,
      path: parsed.data.path,
      content: parsed.data.content,
      isBinary: parsed.data.isBinary ?? false,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const from = normalizePath(parsed.data.from);
  const to = normalizePath(parsed.data.to);

  const files = await db.select().from(projectFile).where(eq(projectFile.projectId, id));
  const allPaths = files.map((file) => file.path);
  const renameResult = buildRenameMap(allPaths, from, to);

  if (!renameResult.ok) {
    return NextResponse.json({ error: renameResult.error }, { status: 400 });
  }

  const pathMap = renameResult.map;
  const updatedFiles = [];

  for (const [oldPath, newPath] of pathMap) {
    const file = files.find((entry) => entry.path === oldPath);
    if (!file) continue;

    const [updated] = await db
      .update(projectFile)
      .set({ path: newPath, updatedAt: new Date() })
      .where(eq(projectFile.id, file.id))
      .returning();
    updatedFiles.push(updated);
  }

  const newMainFile = resolveMainFileAfterRename(access.project.mainFile, pathMap);
  let updatedProject = access.project;
  if (newMainFile !== access.project.mainFile) {
    [updatedProject] = await db
      .update(project)
      .set({ mainFile: newMainFile, updatedAt: new Date() })
      .where(eq(project.id, id))
      .returning();
  }

  return NextResponse.json({
    files: updatedFiles,
    mainFile: updatedProject.mainFile,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path query param required" }, { status: 400 });
  }

  const normalizedPath = normalizePath(path);
  const recursive = searchParams.get("recursive") === "true";

  if (recursive) {
    const files = await db.select().from(projectFile).where(eq(projectFile.projectId, id));
    const allPaths = files.map((file) => file.path);
    const placeholderPath = folderPlaceholderPath(normalizedPath);
    const isFolder =
      allPaths.some((entry) => entry.startsWith(`${normalizedPath}/`)) ||
      allPaths.includes(placeholderPath);

    if (!isFolder) {
      return NextResponse.json({ error: "Path is not a folder" }, { status: 400 });
    }

    const toDelete = pathsUnderPrefix(allPaths, normalizedPath);
    if (toDelete.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    await db
      .delete(projectFile)
      .where(
        and(
          eq(projectFile.projectId, id),
          or(
            eq(projectFile.path, normalizedPath),
            like(projectFile.path, `${normalizedPath}/%`)
          )
        )
      );

    return NextResponse.json({ success: true, deleted: toDelete });
  }

  await db
    .delete(projectFile)
    .where(and(eq(projectFile.projectId, id), eq(projectFile.path, normalizedPath)));

  return NextResponse.json({ success: true, deleted: [normalizedPath] });
}
