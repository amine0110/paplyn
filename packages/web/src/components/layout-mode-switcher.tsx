"use client";

import {
  Columns2,
  LayoutTemplate,
  PanelBottom,
  Rows2,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { WorkspaceLayoutMode } from "@/lib/workspace-layout";
import {
  CHROME_SEGMENT,
  CHROME_SEGMENT_ACTIVE,
  CHROME_SEGMENT_INACTIVE,
} from "@/lib/chrome-interactive";

const MODES: {
  value: WorkspaceLayoutMode;
  label: string;
  icon: typeof LayoutTemplate;
}[] = [
  { value: "editor", label: "Editor", icon: LayoutTemplate },
  { value: "proof", label: "Proof", icon: PanelBottom },
  { value: "columns", label: "Columns", icon: Columns2 },
  { value: "rows", label: "Rows", icon: Rows2 },
];

interface LayoutModeSwitcherProps {
  mode: WorkspaceLayoutMode;
  onChange: (mode: WorkspaceLayoutMode) => void;
  className?: string;
}

export function LayoutModeSwitcher({ mode, onChange, className }: LayoutModeSwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm border border-border bg-paper p-0.5",
        className
      )}
      role="group"
      aria-label="Workspace layout"
    >
      {MODES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            CHROME_SEGMENT,
            mode === value ? CHROME_SEGMENT_ACTIVE : CHROME_SEGMENT_INACTIVE
          )}
          aria-pressed={mode === value}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
