"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import {
  AI_SIDEBAR_WIDTH_DEFAULT,
  clampAiSidebarWidth,
  persistAiSidebarWidth,
  readAiSidebarWidth,
} from "@/lib/ui-preferences";

interface AiSidebarPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function AiSidebarPanel({ children, className }: AiSidebarPanelProps) {
  const [width, setWidth] = useState(AI_SIDEBAR_WIDTH_DEFAULT);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    setWidth(readAiSidebarWidth());
  }, []);

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!draggingRef.current) return;
    const delta = startXRef.current - event.clientX;
    const next = clampAiSidebarWidth(startWidthRef.current + delta);
    setWidth(next);
  }, []);

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
    persistAiSidebarWidth(width);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
  }, [onPointerMove, width]);

  const onResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = width;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
    };
  }, [endDrag, onPointerMove]);

  return (
    <div
      className={cn(
        "absolute right-0 top-0 bottom-0 z-30 flex min-h-0 shadow-2xl",
        className
      )}
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize assistant panel"
        className="group relative z-10 w-1 shrink-0 cursor-col-resize touch-none"
        onPointerDown={onResizePointerDown}
      >
        <div
          className="absolute inset-y-0 -left-1 w-3 opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100"
          aria-hidden
        />
        <div
          className="absolute inset-y-0 left-0 w-px bg-border group-hover:bg-accent/60 group-active:bg-accent"
          aria-hidden
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">{children}</div>
    </div>
  );
}
