import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { getUserZoteroSettings, updateUserZoteroSettings } from "@/lib/user-zotero";

const updateSchema = z.object({
  zoteroUserId: z.string().optional(),
  zoteroApiKey: z.string().optional(),
  clearZoteroApiKey: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getUserZoteroSettings(session.user.id);
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await updateUserZoteroSettings(session.user.id, parsed.data);
  return NextResponse.json(settings);
}
