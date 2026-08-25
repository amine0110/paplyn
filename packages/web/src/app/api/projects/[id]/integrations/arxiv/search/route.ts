import { NextRequest, NextResponse } from "next/server";
import { getProjectAccess } from "@/lib/project-access";
import { getSession } from "@/lib/session";
import { ArxivError, searchArxiv } from "@/lib/arxiv";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const access = await getProjectAccess(id, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Query parameter q is required" }, { status: 400 });
  }

  try {
    const result = await searchArxiv(query);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof ArxivError ? error.message : "arXiv search failed";
    const status = error instanceof ArxivError && error.status ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
