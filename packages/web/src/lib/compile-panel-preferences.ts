export const COMPILE_PANEL_COLLAPSED_KEY = "quire-compile-panel-collapsed";

export function readCompilePanelCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COMPILE_PANEL_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function persistCompilePanelCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COMPILE_PANEL_COLLAPSED_KEY, collapsed ? "true" : "false");
  } catch {
    // ignore storage errors
  }
}

/** Auto-expand when new hard errors appear; warning-only refreshes keep user preference. */
export function shouldAutoExpandCompilePanel(
  prevErrorFingerprint: string,
  nextErrorFingerprint: string,
  collapsed: boolean,
): boolean {
  if (!collapsed) return false;
  if (!nextErrorFingerprint) return false;
  return nextErrorFingerprint !== prevErrorFingerprint;
}
