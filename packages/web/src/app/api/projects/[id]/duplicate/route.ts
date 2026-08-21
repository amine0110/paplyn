import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { project, projectFile } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { buildDuplicateProjectSeed } from "@/lib/project-ops";
import { generateId } from "@/lib/utils";
import { checkProjectLimit } from "@/lib/usage";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limit = await checkProjectLimit(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.reason }, { status: 403 });
  }

  const sourceFiles = await db.select().from(projectFile).where(eq(projectFile.projectId, id));
  const newProjectId = generateId();
  const seed = buildDuplicateProjectSeed({
    sourceProject: access.project,
    sourceFiles,
    newProjectId,
    ownerId: session.user.id,
  });

  await db.insert(project).values(seed.project);

  for (const file of seed.files) {
    await db.insert(projectFile).values({
      id: generateId(),
      ...file,
    });
  }

  const [created] = await db.select().from(project).where(eq(project.id, newProjectId)).limit(1);
  return NextResponse.json(created, { status: 201 });
}
