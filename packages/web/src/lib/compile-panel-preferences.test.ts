import { describe, it, expect, vi } from "vitest";
import {
  COMPILE_PANEL_COLLAPSED_KEY,
  persistCompilePanelCollapsed,
  readCompilePanelCollapsed,
  shouldAutoExpandCompilePanel,
} from "@/lib/compile-panel-preferences";

function stubLocalStorage() {
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    clear: () => {
      storage.clear();
    },
  };

  vi.stubGlobal("window", { localStorage });
  vi.stubGlobal("localStorage", localStorage);
  return storage;
}

describe("compile panel preferences", () => {
  it("defaults to expanded when no preference is stored", () => {
    const storage = stubLocalStorage();
    expect(readCompilePanelCollapsed()).toBe(false);
    expect(storage.size).toBe(0);
    vi.unstubAllGlobals();
  });

  it("persists collapsed state in localStorage", () => {
    const storage = stubLocalStorage();

    persistCompilePanelCollapsed(true);
    expect(storage.get(COMPILE_PANEL_COLLAPSED_KEY)).toBe("true");
    expect(readCompilePanelCollapsed()).toBe(true);

    persistCompilePanelCollapsed(false);
    expect(readCompilePanelCollapsed()).toBe(false);

    vi.unstubAllGlobals();
  });

  it("auto-expands when new hard errors appear while collapsed", () => {
    expect(
      shouldAutoExpandCompilePanel("", "main.tex:42:Undefined control sequence", true),
    ).toBe(true);
    expect(
      shouldAutoExpandCompilePanel(
        "main.tex:42:Undefined control sequence",
        "main.tex:43:Missing $ inserted",
        true,
      ),
    ).toBe(true);
  });

  it("keeps collapsed preference for warning-only refreshes and unchanged errors", () => {
    expect(shouldAutoExpandCompilePanel("", "", true)).toBe(false);
    expect(
      shouldAutoExpandCompilePanel(
        "main.tex:42:Undefined control sequence",
        "main.tex:42:Undefined control sequence",
        true,
      ),
    ).toBe(false);
  });

  it("does not auto-expand when already expanded", () => {
    expect(
      shouldAutoExpandCompilePanel("", "main.tex:42:Undefined control sequence", false),
    ).toBe(false);
  });
});
