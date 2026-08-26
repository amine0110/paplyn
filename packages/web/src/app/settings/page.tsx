"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { updateUser, changePassword } from "@/lib/auth-client";
import { useRequireSession } from "@/lib/use-require-session";
import { Nav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { config } from "@/lib/config";
import { PRODUCT } from "@/lib/product";
import {
  MIN_PASSWORD_LENGTH,
  mapPasswordChangeError,
  validatePasswordChange,
  validateProfileName,
} from "@/lib/profile-validation";
import { labelConnectedProviders } from "@/lib/connected-providers";

export default function SettingsPage() {
  const { session, isPending, isAuthenticated } = useRequireSession({ loginNext: "/settings" });

  const [name, setName] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [providersError, setProvidersError] = useState("");

  const [zoteroUserId, setZoteroUserId] = useState("");
  const [zoteroApiKey, setZoteroApiKey] = useState("");
  const [hasZoteroKey, setHasZoteroKey] = useState(false);
  const [zoteroApiKeyLast4, setZoteroApiKeyLast4] = useState<string | null>(null);
  const [zoteroMessage, setZoteroMessage] = useState("");
  const [zoteroError, setZoteroError] = useState("");
  const [savingZotero, setSavingZotero] = useState(false);


  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session?.user?.name]);

  useEffect(() => {
    if (!isAuthenticated) {
      setConnectedProviders([]);
      setProvidersError("");
      return;
    }

    let cancelled = false;

    async function loadConnectedProviders() {
      try {
        const response = await fetch("/api/auth/connected-providers");
        if (!response.ok) {
          throw new Error("Failed to load sign-in methods");
        }
        const data = (await response.json()) as { providers?: string[] };
        if (!cancelled) {
          setConnectedProviders(data.providers ?? []);
          setProvidersError("");
        }
      } catch {
        if (!cancelled) {
          setConnectedProviders([]);
          setProvidersError("Could not load connected sign-in methods.");
        }
      }
    }

    void loadConnectedProviders();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setZoteroUserId("");
      setZoteroApiKey("");
      setHasZoteroKey(false);
      setZoteroApiKeyLast4(null);
      setZoteroMessage("");
      setZoteroError("");
      return;
    }

    let cancelled = false;

    async function loadZoteroSettings() {
      try {
        const response = await fetch("/api/settings/zotero");
        if (!response.ok) {
          throw new Error("Failed to load Zotero settings");
        }
        const data = (await response.json()) as {
          zoteroUserId?: string | null;
          hasZoteroKey?: boolean;
          zoteroApiKeyLast4?: string | null;
        };
        if (!cancelled) {
          setZoteroUserId(data.zoteroUserId ?? "");
          setHasZoteroKey(Boolean(data.hasZoteroKey));
          setZoteroApiKeyLast4(data.zoteroApiKeyLast4 ?? null);
          setZoteroApiKey("");
          setZoteroError("");
        }
      } catch {
        if (!cancelled) {
          setZoteroError("Could not load Zotero settings.");
        }
      }
    }

    void loadZoteroSettings();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  async function saveZotero(e: React.FormEvent) {
    e.preventDefault();
    setZoteroMessage("");
    setZoteroError("");

    const trimmedUserId = zoteroUserId.trim();
    if (!trimmedUserId) {
      setZoteroError("Zotero user ID is required.");
      return;
    }

    if (!hasZoteroKey && !zoteroApiKey.trim()) {
      setZoteroError("Zotero API key is required.");
      return;
    }

    setSavingZotero(true);
    try {
      const response = await fetch("/api/settings/zotero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoteroUserId: trimmedUserId,
          ...(zoteroApiKey.trim() ? { zoteroApiKey: zoteroApiKey.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setZoteroError(typeof err.error === "string" ? err.error : "Failed to save Zotero settings");
        return;
      }

      const data = (await response.json()) as {
        zoteroUserId?: string | null;
        hasZoteroKey?: boolean;
        zoteroApiKeyLast4?: string | null;
      };
      setZoteroUserId(data.zoteroUserId ?? trimmedUserId);
      setHasZoteroKey(Boolean(data.hasZoteroKey));
      setZoteroApiKeyLast4(data.zoteroApiKeyLast4 ?? null);
      setZoteroApiKey("");
      setZoteroMessage("Zotero settings saved");
    } catch {
      setZoteroError("Something went wrong");
    } finally {
      setSavingZotero(false);
    }
  }

  async function disconnectZotero() {
    setZoteroMessage("");
    setZoteroError("");
    setSavingZotero(true);
    try {
      const response = await fetch("/api/settings/zotero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearZoteroApiKey: true, zoteroApiKey: "" }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setZoteroError(typeof err.error === "string" ? err.error : "Failed to disconnect Zotero");
        return;
      }

      setHasZoteroKey(false);
      setZoteroApiKeyLast4(null);
      setZoteroApiKey("");
      setZoteroMessage("Zotero API key removed");
    } catch {
      setZoteroError("Something went wrong");
    } finally {
      setSavingZotero(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMessage("");
    setProfileError("");

    const validation = validateProfileName(name);
    if (!validation.ok) {
      setProfileError(validation.error);
      return;
    }

    setSavingProfile(true);
    try {
      const result = await updateUser({ name: validation.data });
      if (result.error) {
        setProfileError(result.error.message || "Failed to update profile");
      } else {
        setProfileMessage("Profile saved");
      }
    } catch {
      setProfileError("Something went wrong");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    const validation = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!validation.ok) {
      setPasswordError(validation.error);
      return;
    }

    setChangingPassword(true);
    try {
      const result = await changePassword({
        currentPassword: validation.data.currentPassword,
        newPassword: validation.data.newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setPasswordError(mapPasswordChangeError(result.error.message));
      } else {
        setPasswordMessage("Password changed");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordError("Something went wrong");
    } finally {
      setChangingPassword(false);
    }
  }

  if (isPending || !isAuthenticated || !session?.user) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="max-w-2xl mx-auto px-4 py-8 text-ink-muted">Loading...</div>
      </div>
    );
  }

  const user = session.user;

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl font-semibold mb-8">Settings</h1>

        <div className="space-y-8">
          <form onSubmit={saveProfile}>
            <section className="border border-border rounded-lg p-6 bg-surface">
              <h2 className="font-medium mb-4">Profile</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Connected sign-in methods</Label>
                  {providersError ? (
                    <p className="text-sm text-error">{providersError}</p>
                  ) : connectedProviders.length > 0 ? (
                    <ul className="text-sm text-ink list-disc pl-5 space-y-1">
                      {labelConnectedProviders(connectedProviders).map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-muted">No sign-in methods found.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user.email || ""} disabled />
                  <p className="text-xs text-ink-muted">
                    Email cannot be changed here. Contact your administrator if you need to update it.
                  </p>
                </div>
                {profileError && <p className="text-sm text-error">{profileError}</p>}
                {profileMessage && <p className="text-sm text-success">{profileMessage}</p>}
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </section>
          </form>

          <form onSubmit={handleChangePassword}>
            <section className="border border-border rounded-lg p-6 bg-surface">
              <h2 className="font-medium mb-4">Password</h2>
              <p className="text-sm text-ink-muted mb-4">
                Change your password while signed in. You will need your current password.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                  />
                </div>
                {passwordError && <p className="text-sm text-error">{passwordError}</p>}
                {passwordMessage && <p className="text-sm text-success">{passwordMessage}</p>}
                <Button type="submit" disabled={changingPassword}>
                  {changingPassword ? "Changing..." : "Change password"}
                </Button>
              </div>
            </section>
          </form>

          <section className="border border-border rounded-lg p-6 bg-surface">
            <h2 className="font-medium mb-4">Appearance</h2>
            <p className="text-sm text-ink-muted mb-4">{PRODUCT.appearanceNote}</p>
            <ThemeToggle />
          </section>

          <form onSubmit={saveZotero}>
            <section className="border border-border rounded-lg p-6 bg-surface">
              <h2 className="font-medium mb-2">Zotero</h2>
              <p className="text-sm text-ink-muted mb-4">
                Connect your personal Zotero library to search and cite from{" "}
                <code className="text-xs">references.bib</code> in the editor and AI assistant.
                Create an API key on{" "}
                <a
                  href="https://www.zotero.org/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline cursor-pointer"
                >
                  zotero.org/settings/keys
                </a>
                {" "}(read library access is enough).
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="zotero-user-id">User ID</Label>
                  <Input
                    id="zotero-user-id"
                    value={zoteroUserId}
                    onChange={(e) => setZoteroUserId(e.target.value)}
                    placeholder="Numeric user ID from Zotero settings"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zotero-api-key">API key</Label>
                  <PasswordInput
                    id="zotero-api-key"
                    value={zoteroApiKey}
                    onChange={(e) => setZoteroApiKey(e.target.value)}
                    placeholder={hasZoteroKey ? "••••••••" : "Paste your Zotero API key"}
                    autoComplete="new-password"
                  />
                  {hasZoteroKey && (
                    <p className="text-xs text-ink-muted">
                      Connected
                      {zoteroApiKeyLast4 ? ` (ends with ${zoteroApiKeyLast4})` : ""}. Leave blank to keep
                      the current key.
                    </p>
                  )}
                </div>
                {zoteroError && <p className="text-sm text-error">{zoteroError}</p>}
                {zoteroMessage && <p className="text-sm text-success">{zoteroMessage}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={savingZotero}>
                    {savingZotero ? "Saving..." : "Save Zotero"}
                  </Button>
                  {hasZoteroKey && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingZotero}
                      onClick={() => void disconnectZotero()}
                    >
                      Remove API key
                    </Button>
                  )}
                </div>
              </div>
            </section>
          </form>

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
