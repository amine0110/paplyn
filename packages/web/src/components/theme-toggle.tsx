"use client";

import { useTheme } from "@/components/theme-provider";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/components/ui/cn";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("inline-flex rounded-md border border-border p-0.5 bg-canvas-dark", className)}>
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            "px-3 py-1.5 text-sm rounded transition-colors",
            theme === value
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-muted hover:text-ink"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
