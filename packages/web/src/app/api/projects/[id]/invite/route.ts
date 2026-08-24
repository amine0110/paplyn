import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectMember, projectInvite, user } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { generateId } from "@/lib/utils";
import { buildInviteUrl, formatMemberRole } from "@/lib/project-sharing";
import { getServerAppUrl } from "@/lib/urls";
import { formatEmailFailureReason, sendPlicumEmail, type SendEmailResult } from "@/lib/email/send";
import { renderInviteEmail } from "@/lib/email/templates";
import { PRODUCT_NAME } from "@/lib/product";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["editor", "viewer"]).default("editor"),
  linkOnly: z.boolean().optional(),
});

function inviteLink(inviteId: string) {
  return buildInviteUrl(getServerAppUrl(), inviteId);
}

async function sendInviteEmail({
  to,
  ownerName,
  projectName,
  role,
  inviteId,
}: {
  to: string;
  ownerName: string;
  projectName: string;
  role: "editor" | "viewer";
  inviteId: string;
}): Promise<SendEmailResult> {
  const inviteUrl = inviteLink(inviteId);
  const { subject, html, text } = renderInviteEmail({
    productName: PRODUCT_NAME,
    ownerName,
    projectName,
    roleLabel: formatMemberRole(role),
    inviteUrl,
    appUrl: getServerAppUrl(),
  });

  const result = await sendPlicumEmail({ to, subject, html, text });
  if (!result.sent) {
    console.warn(`[invite] Email not sent to ${to}: ${result.reason}`);
  }
  return result;
}

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

  const [owner] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, access.project.ownerId))
    .limit(1);

  const invites = await db
    .select()
    .from(projectInvite)
    .where(eq(projectInvite.projectId, id));

  return NextResponse.json({
    members,
    owner,
    invites: invites
      .filter((invite) => !invite.accepted)
      .map((invite) => ({
        ...invite,
        link: inviteLink(invite.id),
      })),
    canManage: access.role === "owner",
    role: access.role,
  });
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

  const { email, role, linkOnly } = parsed.data;

  if (email && !linkOnly) {
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existingUser) {
      const [existingMember] = await db
        .select()
        .from(projectMember)
        .where(
          and(eq(projectMember.projectId, id), eq(projectMember.userId, existingUser.id))
        )
        .limit(1);

      if (existingMember) {
        return NextResponse.json({ success: true, added: true, alreadyMember: true });
      }

      await db.insert(projectMember).values({
        id: generateId(),
        projectId: id,
        userId: existingUser.id,
        role,
      });
      return NextResponse.json({ success: true, added: true });
    }

    const [invite] = await db
      .insert(projectInvite)
      .values({
        id: generateId(),
        projectId: id,
        email,
        role,
        invitedBy: session.user.id,
      })
      .returning();

    const emailResult = await sendInviteEmail({
      to: email,
      ownerName: session.user.name || session.user.email,
      projectName: access.project.name,
      role,
      inviteId: invite.id,
    });

    return NextResponse.json(
      {
        ...invite,
        link: inviteLink(invite.id),
        emailSent: emailResult.sent,
        ...(emailResult.sent ? {} : { emailReason: formatEmailFailureReason(emailResult) }),
      },
      { status: 201 }
    );
  }

  const [invite] = await db
    .insert(projectInvite)
    .values({
      id: generateId(),
      projectId: id,
      email: null,
      role,
      invitedBy: session.user.id,
    })
    .returning();

  return NextResponse.json(
    { ...invite, link: inviteLink(invite.id) },
    { status: 201 }
  );
}
