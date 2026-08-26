// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DASHBOARD_PATH,
  handleDashboardBackClick,
  handleHardNavClick,
  isModifiedNavigationClick,
  leaveForDashboard,
} from "@/lib/hard-navigation";

function clickEvent(overrides: Partial<HardNavClickEvent> = {}): HardNavClickEvent {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

type HardNavClickEvent = Parameters<typeof handleHardNavClick>[0];

describe("hard-navigation", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { assign: vi.fn() });
  });

  it("leaveForDashboard assigns /dashboard", () => {
    leaveForDashboard();
    expect(window.location.assign).toHaveBeenCalledWith(DASHBOARD_PATH);
  });

  it("handleHardNavClick assigns on primary left-click", () => {
    const event = clickEvent();
    handleHardNavClick(event, "/dashboard");
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(window.location.assign).toHaveBeenCalledWith("/dashboard");
  });

  it("handleDashboardBackClick assigns /dashboard", () => {
    const event = clickEvent();
    handleDashboardBackClick(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(window.location.assign).toHaveBeenCalledWith("/dashboard");
  });

  it("handleHardNavClick does not intercept modified clicks", () => {
    for (const overrides of [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
      { button: 2 },
    ] as const) {
      const event = clickEvent(overrides);
      handleHardNavClick(event, "/dashboard");
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(window.location.assign).not.toHaveBeenCalled();
      vi.mocked(window.location.assign).mockClear();
    }
  });

  it("isModifiedNavigationClick detects non-primary navigation", () => {
    expect(isModifiedNavigationClick(clickEvent())).toBe(false);
    expect(isModifiedNavigationClick(clickEvent({ ctrlKey: true }))).toBe(true);
    expect(isModifiedNavigationClick(clickEvent({ button: 1 }))).toBe(true);
  });
});
