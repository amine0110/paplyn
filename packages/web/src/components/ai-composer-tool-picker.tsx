"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { AiPluginLogo } from "@/components/ai-plugin-logo";
import { listComposerToolMeta, type AiPluginClientMeta } from "@/lib/ai-plugins/client-meta";
import { CHROME_MENU_ITEM } from "@/lib/chrome-interactive";
import { cn } from "@/components/ui/cn";

interface AiComposerToolPickerProps {
  onSelectTool: (toolName: string, meta: AiPluginClientMeta) => void;
  disabled?: boolean;
  variant?: "sidebar" | "sheet";
  onFocusInput?: () => void;
}

const COMPOSER_TOOLS = listComposerToolMeta();

export function AiComposerToolPicker({
  onSelectTool,
  disabled = false,
  variant = "sidebar",
  onFocusInput,
}: AiComposerToolPickerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const iconBtnSize = variant === "sheet" ? "h-11 w-11" : "h-8 w-8";

  function handlePickTool(tool: AiPluginClientMeta) {
    onSelectTool(tool.toolName, tool);
    setMenuOpen(false);
    onFocusInput?.();
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        disabled={disabled}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors",
          "hover:bg-accent/15 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
          menuOpen && "bg-accent/15 text-accent",
          iconBtnSize
        )}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Choose a tool"
        title="Choose a tool"
      >
        <Plus className="h-4 w-4" />
      </button>

      {menuOpen ? (
        <div
          className="absolute bottom-full left-0 z-50 mb-1.5 w-max max-w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-paper py-1 shadow-lg"
          role="menu"
          aria-label="AI tools"
        >
          {COMPOSER_TOOLS.map((tool) => (
            <button
              key={tool.toolName}
              type="button"
              role="menuitem"
              className={cn(
                CHROME_MENU_ITEM,
                "flex w-full min-h-[44px] items-center gap-2.5 px-3 py-2.5 text-left text-sm"
              )}
              onClick={() => handlePickTool(tool)}
            >
              <AiPluginLogo pluginId={tool.id} />
              <span className="min-w-0 truncate font-medium text-ink">{tool.menuLabel}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface AiComposerToolChipProps {
  meta: AiPluginClientMeta;
  onClear: () => void;
  disabled?: boolean;
}

export function AiComposerToolChip({ meta, onClear, disabled = false }: AiComposerToolChipProps) {
  return (
    <div className="flex px-2 pt-1">
      <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 py-0.5 pl-1.5 pr-1 text-[11px] font-medium text-ink">
        <AiPluginLogo pluginId={meta.id} className="h-4 w-4 text-[8px]" />
        <span className="truncate">{meta.menuLabel}</span>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-accent/15 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
          aria-label={`Remove ${meta.menuLabel} tool`}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </span>
    </div>
  );
}

export function getComposerToolMeta(toolName: string): AiPluginClientMeta | undefined {
  return COMPOSER_TOOLS.find((tool) => tool.toolName === toolName);
}
