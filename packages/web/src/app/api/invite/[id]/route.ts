import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectInvite, project } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { acceptInviteForUser } from "@/lib/project-access";
import { buildProjectUrl } from "@/lib/project-sharing";
import { getServerAppUrl } from "@/lib/urls";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [invite] = await db
    .select({
      id: projectInvite.id,
      role: projectInvite.role,
      accepted: projectInvite.accepted,
      projectId: projectInvite.projectId,
      projectName: project.name,
    })
    .from(projectInvite)
    .innerJoin(project, eq(projectInvite.projectId, project.id))
    .where(eq(projectInvite.id, id))
    .limit(1);

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: invite.id,
    role: invite.role,
    accepted: invite.accepted,
    projectId: invite.projectId,
    projectName: invite.projectName,
    projectUrl: buildProjectUrl(getServerAppUrl(), invite.projectId),
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await acceptInviteForUser(id, session.user as Parameters<typeof acceptInviteForUser>[1]);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    projectId: result.projectId,
    alreadyMember: result.alreadyMember,
    projectUrl: buildProjectUrl(getServerAppUrl(), result.projectId),
  });
}
