"use client";

import { BookOpen, Files, LayoutTemplate } from "lucide-react";
import { cn } from "@/components/ui/cn";
import type { MobileWorkspaceTab } from "@/lib/workspace-layout";

const TABS: {
  value: MobileWorkspaceTab;
  label: string;
  icon: typeof Files;
}[] = [
  { value: "files", label: "Files", icon: Files },
  { value: "editor", label: "Editor", icon: LayoutTemplate },
  { value: "proof", label: "Proof", icon: BookOpen },
];

interface MobileWorkspaceTabsProps {
  activeTab: MobileWorkspaceTab;
  onChange: (tab: MobileWorkspaceTab) => void;
}

export function MobileWorkspaceTabs({ activeTab, onChange }: MobileWorkspaceTabsProps) {
  return (
    <nav
      className="sm:hidden shrink-0 flex border-t border-border bg-paper/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Workspace"
    >
      {TABS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-2 text-[11px] transition-colors min-w-0",
            activeTab === value
              ? "text-accent"
              : "text-ink-muted hover:text-ink"
          )}
          aria-current={activeTab === value ? "page" : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      ))}
    </nav>
  );
}
