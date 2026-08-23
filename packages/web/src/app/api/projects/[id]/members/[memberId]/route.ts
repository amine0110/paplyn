import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { removeProjectMember } from "@/lib/project-access";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, memberId } = await params;
  const result = await removeProjectMember(id, session.user.id, memberId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
