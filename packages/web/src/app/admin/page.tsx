"use client";

import { useState, useEffect, useCallback } from "react";
import { Nav } from "@/components/nav";
import { PRODUCT } from "@/lib/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { config } from "@/lib/config";
import { formatRevisionTimestamp } from "@/lib/format-date";
import { useRequireSession } from "@/lib/use-require-session";
import { leaveForHome } from "@/lib/auth-redirect";

type AdminUserSummary = {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  createdAt: string;
};

export default function AdminPage() {
  const { session, isPending, isAuthenticated } = useRequireSession({ loginNext: "/admin" });
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const [settings, setSettings] = useState({
    name: "",
    openaiApiKey: "",
    openaiBaseUrl: "",
    openaiModel: "",
    compileTimeoutMs: 60000,
    hasOpenaiKey: false,
  });
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [usersError, setUsersError] = useState("");
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState("");

  const loadUsers = useCallback(async (search?: string) => {
    setUsersLoading(true);
    setUsersError("");
    const params = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    const res = await fetch(`/api/admin/users${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    } else {
      const err = await res.json().catch(() => ({}));
      setUsersError(err.error || "Failed to load users");
      setUsers([]);
    }
    setUsersLoading(false);
  }, []);

  useEffect(() => {
    if (!isPending && isAuthenticated && !isAdmin) {
      leaveForHome();
    }
  }, [isPending, isAuthenticated, isAdmin]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUsers([]);
      return;
    }
    async function load() {
      if (config.isSelfHosted) {
        const res = await fetch("/api/admin");
        if (res.ok) {
          const data = await res.json();
          setSettings((s) => ({ ...s, ...data }));
        }
      }
      setLoading(false);
    }
    load();
    loadUsers();
  }, [isAuthenticated, loadUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(userSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, loadUsers]);

  async function confirmRemoveUser(user: AdminUserSummary) {
    setRemoveError("");
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      setRemovingUserId(null);
      await loadUsers(userSearch);
    } else {
      const err = await res.json().catch(() => ({}));
      setRemoveError(err.error || "Failed to remove user");
    }
  }

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

  if (isPending || !isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="max-w-2xl mx-auto px-4 py-8 text-ink-muted">Loading...</div>
      </div>
    );
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
        <h1 className="font-serif text-2xl font-semibold mb-2">Admin</h1>
        <p className="text-sm text-ink-muted mb-8">
          {config.isSelfHosted
            ? PRODUCT.adminSubtitle
            : `Manage accounts on this ${PRODUCT.name} instance.`}
        </p>

        <section className="border border-border rounded-lg p-6 bg-surface space-y-4 mb-8">
          <h2 className="font-medium">Users</h2>
          <div className="space-y-2">
            <Label htmlFor="user-search">Search</Label>
            <Input
              id="user-search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Email or name"
            />
          </div>
          {usersError && <p className="text-sm text-destructive">{usersError}</p>}
          {removeError && <p className="text-sm text-destructive">{removeError}</p>}
          {usersLoading ? (
            <p className="text-sm text-ink-muted">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-ink-muted">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Role</th>
                    <th className="py-2 pr-4 font-medium">Joined</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60">
                      <td className="py-2 pr-4">{u.email}</td>
                      <td className="py-2 pr-4">{u.name}</td>
                      <td className="py-2 pr-4">{u.isAdmin ? "Admin" : u.role}</td>
                      <td className="py-2 pr-4 text-ink-muted">
                        {formatRevisionTimestamp(u.createdAt)}
                      </td>
                      <td className="py-2">
                        {removingUserId === u.id ? (
                          <div className="space-y-2">
                            <p className="text-xs text-ink">
                              Remove {u.name}? This cannot be undone.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => confirmRemoveUser(u)}
                              >
                                Confirm remove
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRemovingUserId(null);
                                  setRemoveError("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRemoveError("");
                              setRemovingUserId(u.id);
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {config.isSelfHosted && (
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
        )}
      </main>
    </div>
  );
}
