"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useTheme } from "@/components/theme-provider";
import type { ThemePreference } from "@/lib/theme";
import {
  CHROME_SEGMENT,
  CHROME_SEGMENT_ACTIVE,
  CHROME_SEGMENT_INACTIVE,
} from "@/lib/chrome-interactive";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm border border-border bg-paper p-0.5",
        className
      )}
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            CHROME_SEGMENT,
            theme === value ? CHROME_SEGMENT_ACTIVE : CHROME_SEGMENT_INACTIVE
          )}
          aria-pressed={theme === value}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
          {!compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
