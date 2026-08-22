import { describe, it, expect } from "vitest";
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
