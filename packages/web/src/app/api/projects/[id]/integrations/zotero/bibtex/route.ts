import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractBibtexCitationKey } from "@/lib/bibtex";
import { getProjectAccess } from "@/lib/project-access";
import { getSession } from "@/lib/session";
import { getUserZoteroCredentials } from "@/lib/user-zotero";
import { fetchZoteroItemBibtex, ZoteroError } from "@/lib/zotero";

const bodySchema = z.object({
  itemKey: z.string().min(1),
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
    return NextResponse.json({ error: "itemKey is required" }, { status: 400 });
  }

  const credentials = await getUserZoteroCredentials(session.user.id);
  if (!credentials) {
    return NextResponse.json(
      { error: "Zotero is not connected. Add your user ID and API key in Settings." },
      { status: 400 }
    );
  }

  try {
    const bibtex = await fetchZoteroItemBibtex(credentials, parsed.data.itemKey);
    const citationKey = extractBibtexCitationKey(bibtex);
    if (!citationKey) {
      return NextResponse.json({ error: "Could not parse BibTeX citation key" }, { status: 502 });
    }

    return NextResponse.json({
      bibtex,
      citationKey,
      itemKey: parsed.data.itemKey,
      source: "zotero",
    });
  } catch (error) {
    const message = error instanceof ZoteroError ? error.message : "Failed to export Zotero BibTeX";
    const status = error instanceof ZoteroError && error.status ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
