export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "quire-theme";

export function resolveDarkMode(preference: ThemePreference): boolean {
  if (preference === "dark") return true;
  if (preference === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return "system";
}

export function applyThemeClass(preference: ThemePreference): boolean {
  const isDark = resolveDarkMode(preference);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", isDark);
  }
  return isDark;
}

export function persistTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // ignore storage errors
  }
}
