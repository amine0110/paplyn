// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MouseEvent } from "react";
import { hardNavigate, handleHardNavClick } from "@/lib/hard-navigate";

function anchorClick(
  overrides: Partial<MouseEvent<HTMLAnchorElement>> = {},
): MouseEvent<HTMLAnchorElement> {
  return {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as MouseEvent<HTMLAnchorElement>;
}

describe("hard-navigate", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { assign: vi.fn() });
  });

  it("hardNavigate assigns internal paths", () => {
    hardNavigate("/dashboard");
    expect(window.location.assign).toHaveBeenCalledWith("/dashboard");
  });

  it("hardNavigate ignores external or protocol-relative paths", () => {
    hardNavigate("https://evil.test");
    hardNavigate("//evil.test");
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("handleHardNavClick assigns on plain primary click", () => {
    const event = anchorClick();
    handleHardNavClick(event, "/dashboard");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.location.assign).toHaveBeenCalledWith("/dashboard");
  });

  it("handleHardNavClick preserves modified and non-primary clicks", () => {
    const middle = anchorClick({ button: 1 });
    handleHardNavClick(middle, "/dashboard");
    expect(middle.preventDefault).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();

    const ctrl = anchorClick({ ctrlKey: true });
    handleHardNavClick(ctrl, "/dashboard");
    expect(ctrl.preventDefault).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});
