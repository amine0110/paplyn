import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { createCollabToken } from "@/lib/collab-token";
import { replaceTextOnCollabServer } from "@/lib/collab-replace-server";

const bodySchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

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

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const token = createCollabToken(id, session.user.id, session.user.name);
  const result = await replaceTextOnCollabServer(
    id,
    token,
    parsed.data.path,
    parsed.data.content,
    req
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 502 });
  }

  return NextResponse.json({
    ok: true,
    bound: result.bound,
    mainTexLength: result.mainTexLength,
  });
}
