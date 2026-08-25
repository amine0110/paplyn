"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Nav } from "@/components/nav";
import { validatePasswordPair } from "@/lib/password-validation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const urlError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validation = validatePasswordPair(password, confirmPassword);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    if (!token) {
      setError("This reset link is invalid or has expired.");
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(result.error.message || "Could not reset password");
      } else {
        setSuccess(true);
        router.push("/login?reset=success");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token && urlError) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-error">This reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-sm text-navy hover:underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-ink-muted">This reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="text-sm text-navy hover:underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <p className="text-sm text-ink text-center" role="status">
        Password updated. Redirecting to sign in...
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm password</Label>
        <PasswordInput
          id="confirm-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <div className="max-w-sm mx-auto px-4 py-20">
        <h1 className="font-serif text-2xl font-semibold text-center mb-8">Choose a new password</h1>
        <Suspense
          fallback={<div className="text-center text-ink-muted text-sm">Loading…</div>}
        >
          <ResetPasswordForm />
        </Suspense>
        <p className="text-sm text-ink-muted text-center mt-6">
          <Link href="/login" className="text-navy hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
