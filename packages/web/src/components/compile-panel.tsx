"use client";

import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { DetectedErrorReportFooter } from "@/components/detected-error-report-footer";
import { FixWithAiButton } from "@/components/fix-with-ai-button";
import { CHROME_ICON_BTN_SM, CHROME_LINK, CHROME_MENU_ITEM } from "@/lib/chrome-interactive";
import { buildCompileFailureReportMessage } from "@/lib/compile-failure-report-message";
import { fingerprintCompileErrors } from "@/lib/compile-fix-auto-retry";
import {
  persistCompilePanelCollapsed,
  readCompilePanelCollapsed,
  shouldAutoExpandCompilePanel,
} from "@/lib/compile-panel-preferences";
import { reportDetectedError } from "@/lib/report-detected-error";
import { cn } from "@/components/ui/cn";

interface CompileError {
  line?: number;
  file?: string;
  message: string;
  severity: "error" | "warning";
}

interface CompilePanelProps {
  log: string;
  errors: CompileError[];
  onJumpToLine: (line: number, file?: string) => void;
  showLog: boolean;
  onToggleLog: () => void;
  onFixWithAi?: () => void;
}

export function CompilePanel({ log, errors, onJumpToLine, showLog, onToggleLog, onFixWithAi }: CompilePanelProps) {
  const errorList = errors.filter((e) => e.severity === "error");
  const warnList = errors.filter((e) => e.severity === "warning");
  const pathname = usePathname();
  const [autoReportSent, setAutoReportSent] = useState(false);
  const [collapsed, setCollapsed] = useState(readCompilePanelCollapsed);
  const failureMessage = useMemo(
    () => buildCompileFailureReportMessage({ errors, log }),
    [errors, log],
  );
  const errorFingerprint = useMemo(() => fingerprintCompileErrors(errors), [errors]);
  const prevErrorFingerprintRef = useRef(errorFingerprint);

  const hasErrors = errorList.length > 0;
  const hasWarnings = warnList.length > 0;
  const hasLog = log.trim().length > 0;

  useEffect(() => {
    const prevFingerprint = prevErrorFingerprintRef.current;
    if (shouldAutoExpandCompilePanel(prevFingerprint, errorFingerprint, collapsed)) {
      setCollapsed(false);
      persistCompilePanelCollapsed(false);
    }
    prevErrorFingerprintRef.current = errorFingerprint;
  }, [errorFingerprint, collapsed]);

  useEffect(() => {
    if (!hasErrors) {
      setAutoReportSent(false);
      return;
    }

    let cancelled = false;
    void reportDetectedError({
      kind: "compile",
      message: failureMessage,
      page: pathname,
    }).then((result) => {
      if (!cancelled) setAutoReportSent(result.sent);
    });

    return () => {
      cancelled = true;
    };
  }, [hasErrors, failureMessage, pathname]);

  if (!hasErrors && !hasWarnings && !showLog && !hasLog) return null;

  function handleToggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      persistCompilePanelCollapsed(next);
      return next;
    });
  }

  return (
    <div
      className={cn(
        "border-t border-border bg-paper/90 flex flex-col shrink-0",
        !collapsed && "max-h-48",
      )}
      aria-expanded={!collapsed}
    >
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1.5 text-sm gap-2",
          !collapsed && "border-b border-border",
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          {errorList.length > 0 && (
            <span className="flex items-center gap-1 text-error shrink-0">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorList.length} error{errorList.length !== 1 ? "s" : ""}
            </span>
          )}
          {onFixWithAi && (
            <FixWithAiButton errorCount={errorList.length} onClick={onFixWithAi} />
          )}
          {hasErrors && (
            <DetectedErrorReportFooter
              sent={autoReportSent}
              message={failureMessage}
              kind="compile"
              page={pathname}
              className="justify-start"
              linkClassName="text-xs"
            />
          )}
          {warnList.length > 0 && (
            <span className="flex items-center gap-1 text-accent shrink-0">
              <AlertTriangle className="h-3.5 w-3.5" />
              {warnList.length} warning{warnList.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleToggleCollapsed}
            className={CHROME_ICON_BTN_SM}
            title={collapsed ? "Expand panel" : "Collapse panel"}
            aria-label={collapsed ? "Expand compile panel" : "Collapse compile panel"}
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          <button onClick={onToggleLog} className={`text-xs ${CHROME_LINK} px-1 py-0.5`}>
            {showLog ? "Hide log" : "Show log"}
          </button>
        </div>
      </div>

      {!collapsed &&
        (showLog ? (
          <pre className="flex-1 overflow-auto p-2 text-xs font-mono text-ink-muted whitespace-pre-wrap">
            {log || "No log output"}
          </pre>
        ) : (
          <div className="flex-1 overflow-auto">
            {errors.map((err, i) => (
              <button
                key={i}
                onClick={() => err.line && onJumpToLine(err.line, err.file)}
                className={`${CHROME_MENU_ITEM} px-3 py-1.5 text-sm border-b border-border/50 flex items-start gap-2`}
              >
                {err.severity === "error" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-error shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                )}
                <span>
                  {err.line && <span className="text-ink-faint mr-2">L{err.line}</span>}
                  {err.message}
                </span>
              </button>
            ))}
          </div>
        ))}
    </div>
  );
}
