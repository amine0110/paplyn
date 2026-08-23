"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

interface FixWithAiButtonProps {
  errorCount: number;
  onClick: () => void;
  className?: string;
}

export function FixWithAiButton({ errorCount, onClick, className }: FixWithAiButtonProps) {
  if (errorCount <= 0) return null;

  return (
    <Button
      type="button"
      variant="accent"
      size="sm"
      className={cn("h-7 gap-1.5 px-2.5 text-xs shrink-0", className)}
      onClick={onClick}
    >
      <Sparkles className="h-3 w-3" aria-hidden />
      Fix with AI
    </Button>
  );
}
