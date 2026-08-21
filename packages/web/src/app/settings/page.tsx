"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { Nav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { config } from "@/lib/config";
import { PRODUCT } from "@/lib/product";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name || "");

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl font-semibold mb-8">Settings</h1>

        <div className="space-y-8">
          <section className="border border-border rounded-lg p-6 bg-surface">
            <h2 className="font-medium mb-4">Profile</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={session?.user?.email || ""} disabled />
              </div>
            </div>
          </section>

          <section className="border border-border rounded-lg p-6 bg-surface">
            <h2 className="font-medium mb-4">Appearance</h2>
            <p className="text-sm text-ink-muted mb-4">
              {PRODUCT.appearanceNote}
            </p>
            <ThemeToggle />
          </section>

          {config.isSaas && (
            <section className="border border-border rounded-lg p-6 bg-surface">
              <h2 className="font-medium mb-2">Billing</h2>
              <p className="text-sm text-ink-muted mb-4">
                Manage your subscription and view usage limits.
              </p>
              <Link href="/settings/billing">
                <Button variant="outline">Manage billing</Button>
              </Link>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
