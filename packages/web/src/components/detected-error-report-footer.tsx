import { ReportIssueLink } from "@/components/report-issue-link";
import { cn } from "@/components/ui/cn";
import { titleForDetectedErrorKind, type DetectedErrorKind } from "@/lib/report-detected-error-dedup";

type DetectedErrorReportFooterProps = {
  sent?: boolean;
  message: string;
  kind: DetectedErrorKind;
  page?: string;
  className?: string;
  linkClassName?: string;
};

export function DetectedErrorReportFooter({
  sent = false,
  message,
  kind,
  page,
  className,
  linkClassName,
}: DetectedErrorReportFooterProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-2 gap-y-1", className)}>
      {sent && <span className="text-xs text-ink-muted">We sent this to us.</span>}
      <ReportIssueLink
        page={page}
        className={linkClassName}
        prefill={{
          title: titleForDetectedErrorKind(kind),
          whatHappened: message,
          steps: kind,
        }}
      />
    </div>
  );
}
