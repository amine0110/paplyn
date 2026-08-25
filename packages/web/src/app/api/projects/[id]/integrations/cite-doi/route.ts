import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProjectAccess } from "@/lib/project-access";
import { getSession } from "@/lib/session";
import { DoiCitationError, resolveDoiCitation } from "@/lib/doi-citation";

const bodySchema = z.object({
  doi: z.string().min(1),
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "DOI is required" }, { status: 400 });
  }

  try {
    const result = await resolveDoiCitation(parsed.data.doi);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof DoiCitationError ? error.message : "Failed to resolve DOI";
    const status = error instanceof DoiCitationError && error.status ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
