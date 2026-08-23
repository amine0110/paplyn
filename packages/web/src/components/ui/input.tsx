import { cn } from "./cn";
import { forwardRef } from "react";
import { FOCUS_RING } from "@/lib/chrome-interactive";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS_RING,
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";
