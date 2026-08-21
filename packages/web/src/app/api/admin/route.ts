import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization } from "@/lib/schema";
import { requireAdmin } from "@/lib/session";
import { config } from "@/lib/config";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  openaiModel: z.string().optional(),
  compileTimeoutMs: z.number().min(5000).max(300000).optional(),
});

export async function GET() {
  if (!config.isSelfHosted) {
    return NextResponse.json({ error: "Admin only available in self-hosted mode" }, { status: 404 });
  }

  await requireAdmin();

  const [org] = await db.select().from(organization).limit(1);
  if (!org) {
    return NextResponse.json({ name: config.orgName });
  }

  return NextResponse.json({
    name: org.name,
    openaiBaseUrl: org.openaiBaseUrl,
    openaiModel: org.openaiModel,
    compileTimeoutMs: org.compileTimeoutMs,
    hasOpenaiKey: !!org.openaiApiKey,
  });
}

export async function PATCH(req: NextRequest) {
  if (!config.isSelfHosted) {
    return NextResponse.json({ error: "Admin only available in self-hosted mode" }, { status: 404 });
  }

  await requireAdmin();

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [org] = await db.select().from(organization).limit(1);

  if (org) {
    const [updated] = await db
      .update(organization)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(organization.id, org.id))
      .returning();
    return NextResponse.json({
      name: updated.name,
      openaiBaseUrl: updated.openaiBaseUrl,
      openaiModel: updated.openaiModel,
      compileTimeoutMs: updated.compileTimeoutMs,
      hasOpenaiKey: !!updated.openaiApiKey,
    });
  }

  const [created] = await db
    .insert(organization)
    .values({
      id: crypto.randomUUID(),
      name: parsed.data.name || config.orgName,
      ...parsed.data,
    })
    .returning();

  return NextResponse.json({
    name: created.name,
    hasOpenaiKey: !!created.openaiApiKey,
  });
}
