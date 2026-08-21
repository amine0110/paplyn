import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { project, projectFile } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";
import { listZipEntries, projectZipFilename } from "@/lib/project-files";

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

  const [proj] = await db.select().from(project).where(eq(project.id, id)).limit(1);
  if (!proj) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const files = await db.select().from(projectFile).where(eq(projectFile.projectId, id));
  const zip = new JSZip();

  for (const entry of listZipEntries(files)) {
    zip.file(entry.path, entry.content);
  }

  const buffer = await zip.generateAsync({ type: "arraybuffer" });
  const filename = projectZipFilename(proj.name);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
