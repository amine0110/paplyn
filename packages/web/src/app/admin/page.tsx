"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/components/nav";
import { PRODUCT } from "@/lib/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminPage() {
  const [settings, setSettings] = useState({
    name: "",
    openaiApiKey: "",
    openaiBaseUrl: "",
    openaiModel: "",
    compileTimeoutMs: 60000,
    hasOpenaiKey: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin")
      .then((r) => r.json())
      .then((data) => {
        setSettings((s) => ({ ...s, ...data }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: settings.name,
        openaiApiKey: settings.openaiApiKey || undefined,
        openaiBaseUrl: settings.openaiBaseUrl || undefined,
        openaiModel: settings.openaiModel || undefined,
        compileTimeoutMs: settings.compileTimeoutMs,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setSettings((s) => ({ ...s, ...data, openaiApiKey: "" }));
      setMessage("Settings saved");
    } else {
      const err = await res.json();
      setMessage(err.error || "Failed to save");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="max-w-2xl mx-auto px-4 py-8 text-ink-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl font-semibold mb-2">Organization Admin</h1>
        <p className="text-sm text-ink-muted mb-8">{PRODUCT.adminSubtitle}</p>

        <form onSubmit={save} className="space-y-6">
          <section className="border border-border rounded-lg p-6 bg-surface space-y-4">
            <h2 className="font-medium">Organization</h2>
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              />
            </div>
          </section>

          <section className="border border-border rounded-lg p-6 bg-surface space-y-4">
            <h2 className="font-medium">AI Configuration</h2>
            <div className="space-y-2">
              <Label htmlFor="openai-key">
                OpenAI API Key {settings.hasOpenaiKey && <span className="text-success text-xs">(configured)</span>}
              </Label>
              <Input
                id="openai-key"
                type="password"
                value={settings.openaiApiKey}
                onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                placeholder={settings.hasOpenaiKey ? "••••••••" : "sk-..."}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-base">Base URL (optional)</Label>
              <Input
                id="openai-base"
                value={settings.openaiBaseUrl}
                onChange={(e) => setSettings({ ...settings, openaiBaseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-model">Model</Label>
              <Input
                id="openai-model"
                value={settings.openaiModel}
                onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                placeholder="gpt-4o-mini"
              />
            </div>
          </section>

          <section className="border border-border rounded-lg p-6 bg-surface space-y-4">
            <h2 className="font-medium">Compilation</h2>
            <div className="space-y-2">
              <Label htmlFor="compile-timeout">Compile timeout (ms)</Label>
              <Input
                id="compile-timeout"
                type="number"
                value={settings.compileTimeoutMs}
                onChange={(e) => setSettings({ ...settings, compileTimeoutMs: parseInt(e.target.value) })}
                min={5000}
                max={300000}
              />
            </div>
          </section>

          {message && <p className="text-sm text-ink-muted">{message}</p>}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </form>
      </main>
    </div>
  );
}
