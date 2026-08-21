import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { restoreProjectRevision } from "@/lib/project-revisions-store";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, revisionId } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await restoreProjectRevision({ projectId: id, revisionId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({
    project: result.project,
    files: result.files,
    pdf: result.pdf,
  });
}
