import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { project, projectFile, projectMember } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { templates, type TemplateId } from "@/lib/templates";
import { generateId } from "@/lib/utils";
import { checkProjectLimit } from "@/lib/usage";
import { acceptPendingInvites } from "@/lib/project-access";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  template: z.enum(["blank", "ieee", "thesis", "beamer"]).default("blank"),
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await acceptPendingInvites(session.user as Parameters<typeof acceptPendingInvites>[0]);

  const owned = await db
    .select()
    .from(project)
    .where(eq(project.ownerId, session.user.id))
    .orderBy(desc(project.updatedAt));

  const memberships = await db
    .select({ project: project, role: projectMember.role })
    .from(projectMember)
    .innerJoin(project, eq(projectMember.projectId, project.id))
    .where(eq(projectMember.userId, session.user.id))
    .orderBy(desc(project.updatedAt));

  const shared = memberships
    .filter((m) => m.project.ownerId !== session.user.id)
    .map((m) => ({ ...m.project, memberRole: m.role }));

  return NextResponse.json({ owned, shared });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkProjectLimit(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.reason }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = templates[parsed.data.template as TemplateId];
  const projectId = generateId();

  await db.insert(project).values({
    id: projectId,
    name: parsed.data.name,
    ownerId: session.user.id,
    mainFile: template.mainFile,
    compiler: template.compiler,
    template: template.id,
  });

  for (const file of template.files) {
    await db.insert(projectFile).values({
      id: generateId(),
      projectId,
      path: file.path,
      content: file.content,
    });
  }

  const [created] = await db.select().from(project).where(eq(project.id, projectId)).limit(1);
  return NextResponse.json(created, { status: 201 });
}
