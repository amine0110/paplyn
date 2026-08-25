"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Nav } from "@/components/nav";

const SUCCESS_MESSAGE =
  "If that email has an account, we sent a reset link. Check your inbox and spam folder.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : "/reset-password";

      const result = await requestPasswordReset({
        email,
        redirectTo,
      });

      if (result.error) {
        setError(result.error.message || "Something went wrong");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="max-w-sm mx-auto px-4 py-20">
        <h1 className="font-serif text-2xl font-semibold text-center mb-2">Reset your password</h1>
        <p className="text-sm text-ink-muted text-center mb-8">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>

        {success ? (
          <p className="text-sm text-ink text-center" role="status">{SUCCESS_MESSAGE}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="text-sm text-ink-muted text-center mt-6">
          <Link href="/login" className="text-navy hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
