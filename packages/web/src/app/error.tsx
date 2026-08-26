"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { buildReportIssueHref } from "@/lib/user-reports-url";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const reportHref =
    typeof window !== "undefined"
      ? buildReportIssueHref(`${window.location.pathname}${window.location.search}`, "error")
      : "/report?source=error";

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-serif text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-ink-muted">
          An unexpected error occurred. You can try again or tell us what happened.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Link href={reportHref}>
            <Button variant="outline">Report this issue</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
