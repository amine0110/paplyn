"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { FOCUS_RING } from "@/lib/chrome-interactive";

interface AiAssistantFabProps {
  onClick: () => void;
  className?: string;
}

/** Floating sparkles button — primary entry point for the AI assistant on all viewports. */
export function AiAssistantFab({ onClick, className }: AiAssistantFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open AI assistant"
      className={cn(
        "fixed z-40 flex h-12 w-12 items-center justify-center rounded-full",
        "bg-accent text-white shadow-lg",
        "transition-colors hover:bg-accent-light active:scale-95",
        FOCUS_RING,
        // Above mobile tab bar (~3.5rem) + safe-area; desktop sits near bottom-right.
        "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] right-4",
        "sm:bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:right-4",
        className
      )}
    >
      <Sparkles className="h-5 w-5" aria-hidden />
    </button>
  );
}
