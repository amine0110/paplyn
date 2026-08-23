import { describe, it, expect, vi } from "vitest";
import {
  applyThemeClass,
  readStoredTheme,
  resolveDarkMode,
  THEME_STORAGE_KEY,
} from "@/lib/theme";
import {
  layoutShowsEditor,
  layoutShowsProof,
  openProofLayout,
  readStoredLayoutMode,
  LAYOUT_STORAGE_KEY,
  effectiveLayoutMode,
  isNarrowViewport,
  layoutModeToMobileTab,
  mobileTabToLayoutMode,
  MOBILE_BREAKPOINT_PX,
} from "@/lib/workspace-layout";
import {
  AI_SIDEBAR_WIDTH_DEFAULT,
  AI_SIDEBAR_WIDTH_KEY,
  AI_SIDEBAR_WIDTH_MAX,
  AI_SIDEBAR_WIDTH_MIN,
  clampAiSidebarWidth,
  persistAiSidebarWidth,
  readAiSidebarWidth,
} from "@/lib/ui-preferences";

describe("theme", () => {
  it("defaults to system preference", () => {
    expect(readStoredTheme()).toBe("system");
  });

  it("resolves explicit light and dark modes", () => {
    expect(resolveDarkMode("light")).toBe(false);
    expect(resolveDarkMode("dark")).toBe(true);
  });

  it("returns resolved dark state from preference", () => {
    expect(applyThemeClass("light")).toBe(false);
    expect(applyThemeClass("dark")).toBe(true);
  });

  it("uses a stable storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("quire-theme");
  });
});

describe("workspace layout", () => {
  it("defaults to editor-only layout", () => {
    expect(readStoredLayoutMode()).toBe("editor");
  });

  it("knows which panes are visible per mode", () => {
    expect(layoutShowsEditor("editor")).toBe(true);
    expect(layoutShowsProof("editor")).toBe(false);
    expect(layoutShowsEditor("proof")).toBe(false);
    expect(layoutShowsProof("proof")).toBe(true);
    expect(layoutShowsEditor("columns")).toBe(true);
    expect(layoutShowsProof("columns")).toBe(true);
    expect(layoutShowsEditor("rows")).toBe(true);
    expect(layoutShowsProof("rows")).toBe(true);
  });

  it("opens proof via columns by default", () => {
    expect(openProofLayout("columns")).toBe("columns");
    expect(openProofLayout("proof")).toBe("proof");
  });

  it("uses a stable storage key", () => {
    expect(LAYOUT_STORAGE_KEY).toBe("quire-workspace-layout");
  });

  it("detects narrow viewports below the sm breakpoint", () => {
    expect(MOBILE_BREAKPOINT_PX).toBe(640);
    expect(isNarrowViewport(375)).toBe(true);
    expect(isNarrowViewport(639)).toBe(true);
    expect(isNarrowViewport(640)).toBe(false);
  });

  it("collapses split modes on narrow viewports", () => {
    expect(effectiveLayoutMode("columns", true)).toBe("editor");
    expect(effectiveLayoutMode("rows", true)).toBe("editor");
    expect(effectiveLayoutMode("proof", true)).toBe("proof");
    expect(effectiveLayoutMode("columns", false)).toBe("columns");
  });

  it("maps layout modes to mobile tabs", () => {
    expect(layoutModeToMobileTab("proof")).toBe("proof");
    expect(layoutModeToMobileTab("editor")).toBe("editor");
    expect(layoutModeToMobileTab("columns")).toBe("editor");
    expect(mobileTabToLayoutMode("proof")).toBe("proof");
    expect(mobileTabToLayoutMode("files")).toBe("editor");
    expect(mobileTabToLayoutMode("editor")).toBe("editor");
  });
});

describe("ui-preferences ai sidebar width", () => {
  it("uses a stable storage key", () => {
    expect(AI_SIDEBAR_WIDTH_KEY).toBe("quire-ai-sidebar-width");
  });

  it("defaults to 380px", () => {
    expect(AI_SIDEBAR_WIDTH_DEFAULT).toBe(380);
  });

  it("clamps sidebar width within min and max", () => {
    expect(clampAiSidebarWidth(200)).toBe(AI_SIDEBAR_WIDTH_MIN);
    expect(clampAiSidebarWidth(280)).toBe(280);
    expect(clampAiSidebarWidth(380)).toBe(380);
    expect(clampAiSidebarWidth(700)).toBe(AI_SIDEBAR_WIDTH_MAX);
    expect(clampAiSidebarWidth(560)).toBe(560);
  });

  it("persists and reads the clamped sidebar width", () => {
    const storage = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);

    persistAiSidebarWidth(431);
    expect(storage.get(AI_SIDEBAR_WIDTH_KEY)).toBe("431");
    expect(readAiSidebarWidth()).toBe(431);

    persistAiSidebarWidth(700);
    expect(storage.get(AI_SIDEBAR_WIDTH_KEY)).toBe(String(AI_SIDEBAR_WIDTH_MAX));
    expect(readAiSidebarWidth()).toBe(AI_SIDEBAR_WIDTH_MAX);

    vi.unstubAllGlobals();
  });
});
