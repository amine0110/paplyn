"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";
import { FixWithAiButton } from "@/components/fix-with-ai-button";
import { CHROME_LINK, CHROME_MENU_ITEM } from "@/lib/chrome-interactive";

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

  const hasErrors = errorList.length > 0;
  const hasWarnings = warnList.length > 0;
  const hasLog = log.trim().length > 0;

  if (!hasErrors && !hasWarnings && !showLog && !hasLog) return null;

  return (
    <div className="border-t border-border bg-paper/90 max-h-48 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-sm">
        <div className="flex items-center gap-3">
          {errorList.length > 0 && (
            <span className="flex items-center gap-1 text-error">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorList.length} error{errorList.length !== 1 ? "s" : ""}
            </span>
          )}
          {onFixWithAi && (
            <FixWithAiButton errorCount={errorList.length} onClick={onFixWithAi} />
          )}
          {warnList.length > 0 && (
            <span className="flex items-center gap-1 text-accent">
              <AlertTriangle className="h-3.5 w-3.5" />
              {warnList.length} warning{warnList.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button onClick={onToggleLog} className={`text-xs ${CHROME_LINK} px-1 py-0.5`}>
          {showLog ? "Hide log" : "Show log"}
        </button>
      </div>

      {showLog ? (
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
      )}
    </div>
  );
}
