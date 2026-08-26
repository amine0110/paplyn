"use client";

import { useEffect, useState } from "react";
import { DetectedErrorReportFooter } from "@/components/detected-error-report-footer";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { reportDetectedError } from "@/lib/report-detected-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [autoReportSent, setAutoReportSent] = useState(false);
  const errorMessage = error.message?.trim() || "Something went wrong";

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    void reportDetectedError({
      kind: "unexpected",
      message: errorMessage,
    }).then((result) => setAutoReportSent(result.sent));
  }, [errorMessage]);

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
        </div>
        <DetectedErrorReportFooter
          sent={autoReportSent}
          message={errorMessage}
          kind="unexpected"
        />
      </main>
    </div>
  );
}
