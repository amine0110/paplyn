"use client";

import { useState } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS } from "@/lib/config";
import { useSession } from "@/lib/auth-client";

export default function BillingPage() {
  const { data: session } = useSession();
  const plan = (session?.user as { plan?: string })?.plan || "free";
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(planName: "student" | "researcher") {
    setLoading(planName);
    const res = await fetch("/api/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planName }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error || "Checkout failed");
    setLoading(null);
  }

  async function openPortal() {
    setLoading("portal");
    const res = await fetch("/api/stripe");
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error || "Portal unavailable");
    setLoading(null);
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl font-semibold mb-8">Billing</h1>

        <div className="border border-border rounded-lg p-6 bg-surface mb-8">
          <h2 className="font-medium mb-2">Current plan</h2>
          <p className="text-2xl font-serif capitalize mb-4">{plan}</p>
          <ul className="text-sm text-ink-muted space-y-1 mb-4">
            <li>{limits.projects} projects</li>
            <li>{limits.compilesPerMonth} compiles per month</li>
            <li>{limits.aiRequestsPerMonth} AI requests per month</li>
          </ul>
          {plan !== "free" && (
            <Button variant="outline" onClick={openPortal} disabled={loading === "portal"}>
              Manage subscription
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-border rounded-lg p-5 bg-surface">
            <h3 className="font-medium">Student</h3>
            <p className="text-xl font-serif my-2">$9/mo</p>
            <ul className="text-sm text-ink-muted space-y-1 mb-4">
              {PLAN_LIMITS.student.projects && <li>{PLAN_LIMITS.student.projects} projects</li>}
              <li>{PLAN_LIMITS.student.compilesPerMonth} compiles/mo</li>
              <li>{PLAN_LIMITS.student.aiRequestsPerMonth} AI requests/mo</li>
            </ul>
            <Button
              className="w-full"
              variant={plan === "student" ? "secondary" : "default"}
              disabled={plan === "student" || loading === "student"}
              onClick={() => checkout("student")}
            >
              {plan === "student" ? "Current plan" : "Upgrade"}
            </Button>
          </div>
          <div className="border border-border rounded-lg p-5 bg-surface">
            <h3 className="font-medium">Researcher</h3>
            <p className="text-xl font-serif my-2">$29/mo</p>
            <ul className="text-sm text-ink-muted space-y-1 mb-4">
              <li>{PLAN_LIMITS.researcher.projects} projects</li>
              <li>{PLAN_LIMITS.researcher.compilesPerMonth} compiles/mo</li>
              <li>{PLAN_LIMITS.researcher.aiRequestsPerMonth} AI requests/mo</li>
            </ul>
            <Button
              className="w-full"
              variant={plan === "researcher" ? "secondary" : "default"}
              disabled={plan === "researcher" || loading === "researcher"}
              onClick={() => checkout("researcher")}
            >
              {plan === "researcher" ? "Current plan" : "Upgrade"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
