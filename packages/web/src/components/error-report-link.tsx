"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { CHROME_LINK } from "@/lib/chrome-interactive";
import { titleForDetectedErrorKind, type DetectedErrorKind } from "@/lib/report-detected-error-dedup";
import { buildReportIssueHref } from "@/lib/user-reports-url";

type ErrorReportLinkProps = {
  message: string;
  kind?: DetectedErrorKind;
  page?: string;
  className?: string;
};

export function ErrorReportLink({ message, kind, page, className }: ErrorReportLinkProps) {
  const pathname = usePathname();
  const currentPage =
    page ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : pathname);

  const href = buildReportIssueHref(currentPage, "error", {
    title: kind ? titleForDetectedErrorKind(kind) : undefined,
    whatHappened: message,
    steps: kind,
  });

  return (
    <Link
      href={href}
      className={cn("text-sm text-accent hover:underline cursor-pointer", CHROME_LINK, className)}
    >
      Report this issue
    </Link>
  );
}
