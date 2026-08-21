import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { createProjectRevision, listProjectRevisions } from "@/lib/project-revisions-store";

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

  const revisions = await listProjectRevisions(id);
  return NextResponse.json({ revisions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access || !access.canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let label: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.label === "string") {
      label = body.label;
    }
  } catch {
    // Empty body is fine for manual snapshots.
  }

  const revision = await createProjectRevision({
    projectId: id,
    userId: session.user.id,
    source: "manual",
    label,
  });

  if (!revision) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(revision, { status: 201 });
}
