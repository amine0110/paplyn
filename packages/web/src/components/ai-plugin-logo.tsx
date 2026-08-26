import { Github } from "lucide-react";
import { cn } from "@/components/ui/cn";

interface AiPluginLogoProps {
  pluginId: string;
  className?: string;
}

/** Compact recognizable marks for registered AI plugins (composer tool menu). */
export function AiPluginLogo({ pluginId, className }: AiPluginLogoProps) {
  switch (pluginId) {
    case "semantic-scholar":
      return (
        <span
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#1857B6] text-[9px] font-bold leading-none text-white",
            className
          )}
          aria-hidden
        >
          S²
        </span>
      );
    case "cite-doi":
      return (
        <span
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#3EB1C8] text-[7px] font-bold leading-none text-white",
            className
          )}
          aria-hidden
        >
          DOI
        </span>
      );
    case "arxiv":
      return (
        <span
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#B31B1B] font-serif text-[11px] font-bold leading-none text-white",
            className
          )}
          aria-hidden
        >
          X
        </span>
      );
    case "zotero":
      return (
        <span
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#DB2C3A] font-semibold text-[10px] leading-none text-white",
            className
          )}
          aria-hidden
        >
          Z
        </span>
      );
    case "github-import":
      return (
        <Github
          className={cn("h-5 w-5 shrink-0 text-ink", className)}
          aria-hidden
        />
      );
    default:
      return null;
  }
}
