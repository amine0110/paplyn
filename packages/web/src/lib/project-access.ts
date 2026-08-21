import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { project, projectMember, projectInvite } from "./schema";
import type { User } from "./schema";

export async function getProjectAccess(projectId: string, userId: string) {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId)).limit(1);
  if (!proj) return null;

  if (proj.ownerId === userId) {
    return { project: proj, role: "owner" as const, canEdit: true };
  }

  const [member] = await db
    .select()
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, userId)))
    .limit(1);

  if (member) {
    return {
      project: proj,
      role: member.role,
      canEdit: member.role === "owner" || member.role === "editor",
    };
  }

  return null;
}

export async function acceptPendingInvites(user: User) {
  const invites = await db
    .select()
    .from(projectInvite)
    .where(and(eq(projectInvite.email, user.email), eq(projectInvite.accepted, false)));

  for (const invite of invites) {
    await db.insert(projectMember).values({
      id: crypto.randomUUID(),
      projectId: invite.projectId,
      userId: user.id,
      role: invite.role,
    });

    await db
      .update(projectInvite)
      .set({ accepted: true })
      .where(eq(projectInvite.id, invite.id));
  }
}
