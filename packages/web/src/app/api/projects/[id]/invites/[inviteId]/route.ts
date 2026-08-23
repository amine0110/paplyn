import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { revokeProjectInvite } from "@/lib/project-access";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, inviteId } = await params;
  const result = await revokeProjectInvite(id, session.user.id, inviteId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
