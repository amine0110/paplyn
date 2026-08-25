"use client";

import { cn } from "@/components/ui/cn";

export type ToastVariant = "error" | "success" | "info";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
}

export function Toast({ message, variant = "info" }: ToastProps) {
  return (
    <div
      role="alert"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] max-w-md w-[calc(100%-2rem)]",
        "rounded-lg border border-border bg-surface px-4 py-3 shadow-lg text-sm",
        variant === "error" && "border-error/30 text-error",
        variant === "success" && "border-accent/30 text-accent",
        variant === "info" && "text-ink"
      )}
    >
      {message}
    </div>
  );
}
