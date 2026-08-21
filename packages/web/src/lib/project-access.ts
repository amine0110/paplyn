import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { project, projectMember, projectInvite } from "./schema";
import type { User } from "./schema";
import { roleCanEdit, type ProjectRole } from "./project-sharing";

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
      role: member.role as ProjectRole,
      canEdit: roleCanEdit(member.role),
    };
  }

  return null;
}

export async function acceptInviteForUser(inviteId: string, user: User) {
  const [invite] = await db
    .select()
    .from(projectInvite)
    .where(and(eq(projectInvite.id, inviteId), eq(projectInvite.accepted, false)))
    .limit(1);

  if (!invite) {
    return { ok: false as const, error: "Invite not found or already accepted" };
  }

  const access = await getProjectAccess(invite.projectId, user.id);
  if (access) {
    await db
      .update(projectInvite)
      .set({ accepted: true })
      .where(eq(projectInvite.id, invite.id));
    return { ok: true as const, projectId: invite.projectId, alreadyMember: true };
  }

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

  return { ok: true as const, projectId: invite.projectId, alreadyMember: false };
}

export async function acceptPendingInvites(user: User) {
  const invites = await db
    .select()
    .from(projectInvite)
    .where(
      and(
        eq(projectInvite.email, user.email),
        eq(projectInvite.accepted, false),
        isNotNull(projectInvite.email)
      )
    );

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
