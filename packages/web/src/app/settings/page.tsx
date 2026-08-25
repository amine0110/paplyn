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
import { config } from "@/lib/config";
import { PRODUCT } from "@/lib/product";
import {
  MIN_PASSWORD_LENGTH,
  mapPasswordChangeError,
  validatePasswordChange,
  validateProfileName,
} from "@/lib/profile-validation";

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


  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name);
    }
  }, [session?.user?.name]);

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
