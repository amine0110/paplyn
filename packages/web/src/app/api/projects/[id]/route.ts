import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { project, projectFile } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { listTexFiles, validateProjectSettingsUpdate } from "@/lib/project-ops";

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

  return NextResponse.json(access.project);
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
  const files = await db.select({ path: projectFile.path }).from(projectFile).where(eq(projectFile.projectId, id));
  const validated = validateProjectSettingsUpdate(body, listTexFiles(files.map((f) => f.path)));

  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const [updated] = await db
    .update(project)
    .set({ ...validated.data, updatedAt: new Date() })
    .where(eq(project.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || access.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(project).where(eq(project.id, id));
  return NextResponse.json({ success: true });
}
