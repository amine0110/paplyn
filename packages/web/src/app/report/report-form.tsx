"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUiFeedback } from "@/components/ui-feedback";
import { USER_REPORT_CSRF_HEADER } from "@/lib/user-reports-csrf-constants";
import {
  REPORT_EMAIL_MAX,
  REPORT_STEPS_MAX,
  REPORT_TITLE_MAX,
  REPORT_WHAT_HAPPENED_MAX,
} from "@/lib/user-reports-validation";
import { PRODUCT } from "@/lib/product";

type TurnstileRenderOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type ReportFormProps = {
  csrfToken?: string;
  reportsEnabled: boolean;
  turnstileSiteKey: string | null;
  signedIn: boolean;
  sessionEmail: string | null;
  initialTitle?: string;
  initialWhatHappened?: string;
  initialSteps?: string;
  initialPage?: string;
  initialSource?: "report" | "error";
};

export function ReportForm({
  csrfToken: initialCsrfToken = "",
  reportsEnabled,
  turnstileSiteKey,
  signedIn,
  sessionEmail,
  initialTitle = "",
  initialWhatHappened = "",
  initialSteps = "",
  initialPage = "",
  initialSource = "report",
}: ReportFormProps) {
  const { notice } = useUiFeedback();
  const [title, setTitle] = useState(initialTitle);
  const [whatHappened, setWhatHappened] = useState(initialWhatHappened);
  const [steps, setSteps] = useState(initialSteps);
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [csrfToken, setCsrfToken] = useState(initialCsrfToken);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileScriptLoadedRef = useRef(false);
  const csrfFetchRef = useRef<Promise<string | null> | null>(null);

  const ensureCsrfToken = useCallback(async (): Promise<string | null> => {
    if (csrfToken) return csrfToken;
    if (csrfFetchRef.current) return csrfFetchRef.current;

    csrfFetchRef.current = (async () => {
      try {
        const response = await fetch("/api/user-reports/csrf", { credentials: "same-origin" });
        if (!response.ok) return null;
        const data = (await response.json()) as { csrfToken?: string };
        const token = typeof data.csrfToken === "string" ? data.csrfToken : null;
        if (token) setCsrfToken(token);
        return token;
      } catch {
        return null;
      } finally {
        csrfFetchRef.current = null;
      }
    })();

    return csrfFetchRef.current;
  }, [csrfToken]);

  const resetTurnstile = useCallback(() => {
    if (window.turnstile && turnstileWidgetIdRef.current) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
    setTurnstileToken("");
  }, []);

  useEffect(() => {
    if (!initialCsrfToken && reportsEnabled) {
      void ensureCsrfToken();
    }
  }, [initialCsrfToken, reportsEnabled, ensureCsrfToken]);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileRef.current) return;

    function renderWidget() {
      if (!turnstileRef.current || !window.turnstile || !turnstileSiteKey) return;
      if (turnstileWidgetIdRef.current) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
      turnstileWidgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => setTurnstileToken(token),
        "error-callback": () => setTurnstileToken(""),
        "expired-callback": () => setTurnstileToken(""),
      });
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }

    if (turnstileScriptLoadedRef.current) return;
    turnstileScriptLoadedRef.current = true;

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => renderWidget();
    document.head.appendChild(script);
  }, [turnstileSiteKey]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!reportsEnabled) {
      notice({ message: "Reports are not configured on this server.", variant: "error" });
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      notice({ message: "Please complete the captcha.", variant: "error" });
      return;
    }

    const token = await ensureCsrfToken();
    if (!token) {
      notice({
        message: "Could not start a secure session. Please refresh and try again.",
        variant: "error",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/user-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [USER_REPORT_CSRF_HEADER]: token,
        },
        body: JSON.stringify({
          title,
          whatHappened,
          steps,
          email: signedIn ? undefined : email,
          page: initialPage,
          source: initialSource,
          honeypot,
          csrfToken: token,
          turnstileToken: turnstileSiteKey ? turnstileToken : undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        notice({
          message: typeof err.error === "string" ? err.error : "Could not submit report",
          variant: "error",
        });
        resetTurnstile();
        return;
      }

      notice({ message: "Thank you — your report was submitted.", variant: "success" });
      setTitle("");
      setWhatHappened("");
      setSteps("");
      if (!signedIn) setEmail("");
      resetTurnstile();
    } catch {
      notice({ message: "Could not submit report", variant: "error" });
      resetTurnstile();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl font-semibold mb-2">Report an issue</h1>
        <p className="text-sm text-ink-muted mb-8">
          Tell us what went wrong on {PRODUCT.name}. We read every report and use them to improve the
          product. For account help, you can also check{" "}
          <Link href="/docs" className="text-accent hover:underline cursor-pointer">documentation</Link>.
        </p>

        {!reportsEnabled && (
          <p className="mb-6 text-sm text-ink-muted border border-border rounded-lg p-4 bg-surface">
            Reports are not configured on this server yet.
          </p>
        )}

        <form onSubmit={handleSubmit} className="relative space-y-6 border border-border rounded-lg p-6 bg-surface">
          <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
            <label htmlFor="report-honeypot">Company</label>
            <input
              id="report-honeypot"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-title">Short title</Label>
            <Input
              id="report-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={REPORT_TITLE_MAX}
              required
              disabled={!reportsEnabled || submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-what-happened">What happened?</Label>
            <textarea
              id="report-what-happened"
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value)}
              maxLength={REPORT_WHAT_HAPPENED_MAX}
              required
              rows={5}
              disabled={!reportsEnabled || submitting}
              className="flex w-full rounded-md border border-border bg-paper px-3 py-2 text-sm ring-offset-background placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-steps">Steps to reproduce (optional)</Label>
            <textarea
              id="report-steps"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              maxLength={REPORT_STEPS_MAX}
              rows={4}
              disabled={!reportsEnabled || submitting}
              className="flex w-full rounded-md border border-border bg-paper px-3 py-2 text-sm ring-offset-background placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {signedIn ? (
            <div className="space-y-2">
              <Label>Email</Label>
              <p className="text-sm text-ink-muted">
                We will attach <span className="text-ink">{sessionEmail}</span> from your signed-in session.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="report-email">Email (optional)</Label>
              <Input
                id="report-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={REPORT_EMAIL_MAX}
                autoComplete="email"
                disabled={!reportsEnabled || submitting}
              />
              <p className="text-xs text-ink-muted">Optional — only if you want us to follow up.</p>
            </div>
          )}

          {initialPage && (
            <div className="space-y-1">
              <Label>Page</Label>
              <p className="text-sm text-ink-muted font-mono break-all">{initialPage}</p>
            </div>
          )}

          {turnstileSiteKey && reportsEnabled && (
            <div ref={turnstileRef} className="min-h-[65px]" />
          )}

          <Button type="submit" disabled={!reportsEnabled || submitting}>
            {submitting ? "Submitting…" : "Submit report"}
          </Button>
        </form>
      </main>
    </div>
  );
}
