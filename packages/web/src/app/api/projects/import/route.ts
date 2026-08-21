import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { project, projectFile } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { generateId } from "@/lib/utils";
import { checkProjectLimit } from "@/lib/usage";
import { parseProjectZip } from "@/lib/zip-import";

const MAX_ZIP_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await checkProjectLimit(session.user.id);
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.reason }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const nameRaw = formData.get("name");
  const zipEntry = formData.get("zip");

  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const name = nameRaw.trim();
  if (name.length > 200) {
    return NextResponse.json({ error: "Name must be 200 characters or fewer" }, { status: 400 });
  }

  if (!(zipEntry instanceof File)) {
    return NextResponse.json({ error: "A .zip file is required" }, { status: 400 });
  }

  if (!zipEntry.name.toLowerCase().endsWith(".zip") && zipEntry.type !== "application/zip") {
    return NextResponse.json({ error: "Upload must be a .zip archive" }, { status: 400 });
  }

  if (zipEntry.size > MAX_ZIP_BYTES) {
    return NextResponse.json({ error: "Zip file must be 50 MB or smaller" }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = await zipEntry.arrayBuffer();
    parsed = await parseProjectZip(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read zip archive";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const projectId = generateId();

  await db.insert(project).values({
    id: projectId,
    name,
    ownerId: session.user.id,
    mainFile: parsed.mainFile,
    compiler: "pdflatex",
    template: null,
  });

  for (const file of parsed.files) {
    await db.insert(projectFile).values({
      id: generateId(),
      projectId,
      path: file.path,
      content: file.content,
      isBinary: file.isBinary ?? false,
    });
  }

  const [created] = await db.select().from(project).where(eq(project.id, projectId)).limit(1);
  return NextResponse.json(created, { status: 201 });
}
