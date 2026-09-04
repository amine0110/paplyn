"use client";

import { cn } from "@/components/ui/cn";
import {
  AI_PROGRESS_CHIP,
  AI_PROGRESS_CHIP_ACTIVE,
  AI_WORKING_PROGRESS,
} from "@/lib/chrome-interactive";

function TypingDots() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-hidden="true">
      <span className="ai-typing-dot" />
      <span className="ai-typing-dot" />
      <span className="ai-typing-dot" />
    </span>
  );
}

export function AiWorkingProgress({
  steps,
  compact = false,
  className,
}: {
  steps: string[];
  compact?: boolean;
  className?: string;
}) {
  if (steps.length === 0) return null;

  const activeIndex = steps.length - 1;

  return (
    <div
      className={cn(AI_WORKING_PROGRESS, "flex flex-wrap items-center gap-1.5", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Assistant is working"
    >
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        return (
          <span
            key={`${index}-${step}`}
            className={cn(
              AI_PROGRESS_CHIP,
              "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 font-medium leading-snug",
              compact ? "py-0.5 text-[11px]" : "py-1 text-xs",
              isActive
                ? cn(AI_PROGRESS_CHIP_ACTIVE, "text-ink")
                : "border-border/50 bg-canvas-dark/30 text-ink-faint"
            )}
          >
            {isActive ? <TypingDots /> : null}
            <span className="truncate">{step}</span>
          </span>
        );
      })}
    </div>
  );
}
