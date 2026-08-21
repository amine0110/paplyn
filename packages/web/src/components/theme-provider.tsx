"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyThemeClass,
  persistTheme,
  readStoredTheme,
  resolveDarkMode,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme());
  const [systemDark, setSystemDark] = useState(false);

  const setTheme = useCallback((next: ThemePreference) => {
    persistTheme(next);
    setThemeState(next);
    applyThemeClass(next);
  }, []);

  useEffect(() => {
    applyThemeClass(theme);
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => {
      setSystemDark(media.matches);
      applyThemeClass("system");
    };

    syncSystem();
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, [theme]);

  const isDark = useMemo(() => {
    if (theme === "system") return systemDark;
    return resolveDarkMode(theme);
  }, [theme, systemDark]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      isDark,
    }),
    [theme, setTheme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
