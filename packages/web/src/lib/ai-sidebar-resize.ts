import { clampAiSidebarWidth } from "@/lib/ui-preferences";

export function computeAiSidebarDragWidth(
  startClientX: number,
  clientX: number,
  startWidth: number
): number {
  const delta = startClientX - clientX;
  return clampAiSidebarWidth(startWidth + delta);
}

export type AiSidebarDragSession = {
  move(clientX: number): number;
  end(): number;
};

export function createAiSidebarDragSession(
  startClientX: number,
  startWidth: number
): AiSidebarDragSession {
  let currentWidth = startWidth;
  return {
    move(clientX: number) {
      currentWidth = computeAiSidebarDragWidth(startClientX, clientX, startWidth);
      return currentWidth;
    },
    end() {
      return currentWidth;
    },
  };
}
