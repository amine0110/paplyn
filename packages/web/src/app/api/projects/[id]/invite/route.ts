import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectMember, projectInvite, user } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]).default("editor"),
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

  const members = await db
    .select({
      id: projectMember.id,
      role: projectMember.role,
      userId: projectMember.userId,
      name: user.name,
      email: user.email,
    })
    .from(projectMember)
    .innerJoin(user, eq(projectMember.userId, user.id))
    .where(eq(projectMember.projectId, id));

  const invites = await db
    .select()
    .from(projectInvite)
    .where(eq(projectInvite.projectId, id));

  return NextResponse.json({ members, invites });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || access.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, parsed.data.email))
    .limit(1);

  if (existingUser) {
    const [existingMember] = await db
      .select()
      .from(projectMember)
      .where(eq(projectMember.userId, existingUser.id))
      .limit(1);

    if (!existingMember) {
      await db.insert(projectMember).values({
        id: generateId(),
        projectId: id,
        userId: existingUser.id,
        role: parsed.data.role,
      });
    }
    return NextResponse.json({ success: true, added: true });
  }

  const [invite] = await db
    .insert(projectInvite)
    .values({
      id: generateId(),
      projectId: id,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: session.user.id,
    })
    .returning();

  return NextResponse.json(invite, { status: 201 });
}
