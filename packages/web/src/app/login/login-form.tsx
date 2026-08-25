"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Nav } from "@/components/nav";
import { PRODUCT } from "@/lib/product";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

type LoginFormProps = {
  googleEnabled: boolean;
};

function LoginForm({ googleEnabled }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const resetSuccess = searchParams.get("reset") === "success";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || "Invalid credentials");
      } else {
        router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const callbackURL = nextPath.startsWith("/") ? nextPath : "/dashboard";

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="max-w-sm mx-auto px-4 py-20">
        <h1 className="font-serif text-2xl font-semibold text-center mb-8">{PRODUCT.signInHeading}</h1>

        {resetSuccess && (
          <p className="text-sm text-ink text-center mb-4" role="status">
            Your password has been updated. Sign in with your new password.
          </p>
        )}

        {googleEnabled && (
          <div className="space-y-4 mb-6">
            <GoogleSignInButton callbackURL={callbackURL} />
            <p className="text-xs text-center text-ink-muted">or sign in with email</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-navy hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="text-sm text-ink-muted text-center mt-6">
          No account?{" "}
          <Link href="/signup" className="text-navy hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}

export function LoginPageClient({ googleEnabled }: LoginFormProps) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-ink-muted">Loading…</div>}>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
