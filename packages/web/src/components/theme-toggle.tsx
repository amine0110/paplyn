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

const CYCLE_ORDER: ThemePreference[] = ["light", "dark", "system"];

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

function ThemeSegmentGroup({ compact, className }: { compact: boolean; className?: string }) {
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

function ThemeCycleButton({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0];
  const Icon = current.icon;

  function cycleTheme() {
    const idx = CYCLE_ORDER.indexOf(theme);
    setTheme(CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length]);
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border bg-paper text-ink-muted transition-colors hover:bg-accent/15 hover:text-ink dark:hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-paper",
        className
      )}
      aria-label={`Theme: ${current.label}. Tap to switch.`}
      title={`Theme: ${current.label}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  return (
    <>
      <ThemeCycleButton className={cn("md:hidden", className)} />
      <ThemeSegmentGroup compact={compact} className={cn("hidden md:inline-flex", className)} />
    </>
  );
}
