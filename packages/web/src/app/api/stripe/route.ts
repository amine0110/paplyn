import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/schema";
import { getSession } from "@/lib/session";
import { config } from "@/lib/config";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["student", "researcher"]),
});

export async function POST(req: NextRequest) {
  if (!config.isSaas) {
    return NextResponse.json({ error: "Billing not available in self-hosted mode" }, { status: 404 });
  }

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const priceId =
    parsed.data.plan === "student"
      ? config.stripe.prices.student
      : config.stripe.prices.researcher;

  if (!priceId) {
    return NextResponse.json({ error: "Stripe prices not configured" }, { status: 500 });
  }

  const [u] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);

  const checkoutSession = await createCheckoutSession(
    u?.stripeCustomerId || null,
    priceId,
    session.user.id,
    session.user.email
  );

  return NextResponse.json({ url: checkoutSession.url });
}

export async function GET() {
  if (!config.isSaas) {
    return NextResponse.json({ error: "Billing not available in self-hosted mode" }, { status: 404 });
  }

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [u] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
  if (!u?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account" }, { status: 400 });
  }

  const portalSession = await createPortalSession(u.stripeCustomerId);
  return NextResponse.json({ url: portalSession.url });
}
