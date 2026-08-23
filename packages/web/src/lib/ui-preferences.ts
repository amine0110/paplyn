export const AI_SIDEBAR_WIDTH_KEY = "quire-ai-sidebar-width";

export const AI_SIDEBAR_WIDTH_DEFAULT = 380;
export const AI_SIDEBAR_WIDTH_MIN = 280;
export const AI_SIDEBAR_WIDTH_MAX = 560;

export function clampAiSidebarWidth(width: number): number {
  return Math.min(AI_SIDEBAR_WIDTH_MAX, Math.max(AI_SIDEBAR_WIDTH_MIN, width));
}

export function readAiSidebarWidth(): number {
  if (typeof window === "undefined") return AI_SIDEBAR_WIDTH_DEFAULT;
  try {
    const stored = localStorage.getItem(AI_SIDEBAR_WIDTH_KEY);
    if (!stored) return AI_SIDEBAR_WIDTH_DEFAULT;
    const parsed = Number.parseInt(stored, 10);
    if (!Number.isFinite(parsed)) return AI_SIDEBAR_WIDTH_DEFAULT;
    return clampAiSidebarWidth(parsed);
  } catch {
    return AI_SIDEBAR_WIDTH_DEFAULT;
  }
}

export function persistAiSidebarWidth(width: number): void {
  try {
    localStorage.setItem(AI_SIDEBAR_WIDTH_KEY, String(clampAiSidebarWidth(width)));
  } catch {
    // ignore storage errors
  }
}
