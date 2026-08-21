import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectFile } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const fileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  isBinary: z.boolean().optional(),
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

  await db
    .delete(projectFile)
    .where(and(eq(projectFile.projectId, id), eq(projectFile.path, path)));

  return NextResponse.json({ success: true });
}
