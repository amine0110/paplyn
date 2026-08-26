"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { CHROME_LINK } from "@/lib/chrome-interactive";
import { buildReportIssueHref, type ReportIssuePrefill } from "@/lib/user-reports-url";

type ReportIssueLinkProps = {
  page?: string;
  prefill?: ReportIssuePrefill;
  className?: string;
  children?: React.ReactNode;
};

export function ReportIssueLink({ page, prefill, className, children }: ReportIssueLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentPage = page ?? (query ? `${pathname}?${query}` : pathname);
  const href = buildReportIssueHref(currentPage, "error", prefill);

  return (
    <Link href={href} className={cn("text-sm text-accent hover:underline cursor-pointer", CHROME_LINK, className)}>
      {children ?? "Report this issue"}
    </Link>
  );
}
