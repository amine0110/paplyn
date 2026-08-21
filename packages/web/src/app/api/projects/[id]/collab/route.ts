import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createCollabToken } from "@/lib/collab-token";
import { getProjectAccess } from "@/lib/project-access";
import { config } from "@/lib/config";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = createCollabToken(id, session.user.id, session.user.name);
  const wsUrl = `${config.collabUrl}/${id}?token=${encodeURIComponent(token)}`;

  return NextResponse.json({ token, wsUrl, canEdit: access.canEdit });
}
