"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { CHROME_LINK } from "@/lib/chrome-interactive";
import {
  buildCompileFailureReportMessage,
  type CompileFailureReportError,
} from "@/lib/compile-failure-report-message";
import { titleForDetectedErrorKind } from "@/lib/report-detected-error-dedup";
import { buildReportIssueHref } from "@/lib/user-reports-url";

type ProjectReportLinkProps = {
  compileErrors?: readonly CompileFailureReportError[];
  compileLog?: string;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  role?: string;
};

export function ProjectReportLink({
  compileErrors = [],
  compileLog = "",
  className,
  children,
  onClick,
  role,
}: ProjectReportLinkProps) {
  const pathname = usePathname();
  const compileReportMessage = buildCompileFailureReportMessage({
    errors: compileErrors,
    log: compileLog,
  });
  const hasCompileErrors = compileErrors.some((error) => error.severity === "error");
  const href =
    hasCompileErrors && compileReportMessage
      ? buildReportIssueHref(pathname, "error", {
          title: titleForDetectedErrorKind("compile"),
          whatHappened: compileReportMessage,
          steps: "compile",
        })
      : buildReportIssueHref(pathname, "report");

  return (
    <Link
      href={href}
      className={cn("text-sm", CHROME_LINK, className)}
      onClick={onClick}
      role={role}
    >
      {children ?? "Report"}
    </Link>
  );
}
