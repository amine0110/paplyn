"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Nav } from "@/components/nav";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import { OrcidSignInButton } from "@/components/auth/orcid-sign-in-button";
import { validatePasswordPair } from "@/lib/password-validation";
import { buildSocialOAuthErrorCallbackURL, OAUTH_ERROR_MESSAGE, ORCID_NO_EMAIL_ERROR_MESSAGE } from "@/lib/auth-social";
import { resolveInternalNextPath } from "@/lib/internal-path";

type SignupFormProps = {
  googleEnabled: boolean;
  githubEnabled: boolean;
  orcidEnabled: boolean;
};

function SignupForm({ googleEnabled, githubEnabled, orcidEnabled }: SignupFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";
  const oauthError = searchParams.get("error") === "oauth";
  const orcidNoEmailError = searchParams.get("error") === "email_not_found";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackURL = resolveInternalNextPath(nextPath);
  const errorCallbackURL = buildSocialOAuthErrorCallbackURL("signup", callbackURL);
  const loginHref =
    callbackURL !== "/dashboard"
      ? `/login?next=${encodeURIComponent(callbackURL)}`
      : "/login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validation = validatePasswordPair(password, confirmPassword);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setLoading(true);

    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message || "Could not create account");
      } else {
        router.push(callbackURL);
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
        <h1 className="font-serif text-2xl font-semibold text-center mb-8">Create your account</h1>

        {orcidNoEmailError && (
          <p className="text-sm text-error text-center mb-4" role="alert">
            {ORCID_NO_EMAIL_ERROR_MESSAGE}
          </p>
        )}

        {oauthError && (
          <p className="text-sm text-error text-center mb-4" role="alert">
            {OAUTH_ERROR_MESSAGE}
          </p>
        )}

        {(googleEnabled || githubEnabled || orcidEnabled) && (
          <div className="space-y-4 mb-6">
            {googleEnabled && (
              <GoogleSignInButton callbackURL={callbackURL} errorCallbackURL={errorCallbackURL} />
            )}
            {githubEnabled && (
              <GitHubSignInButton callbackURL={callbackURL} errorCallbackURL={errorCallbackURL} />
            )}
            {orcidEnabled && (
              <OrcidSignInButton callbackURL={callbackURL} errorCallbackURL={errorCallbackURL} />
            )}
            <p className="text-xs text-center text-ink-muted">or sign up with email</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
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
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="text-sm text-ink-muted text-center mt-6">
          Already have an account?{" "}
          <Link href={loginHref} className="text-navy hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export function SignupPageClient({ googleEnabled, githubEnabled, orcidEnabled }: SignupFormProps) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-ink-muted">Loading…</div>}>
      <SignupForm googleEnabled={googleEnabled} githubEnabled={githubEnabled} orcidEnabled={orcidEnabled} />
    </Suspense>
  );
}
