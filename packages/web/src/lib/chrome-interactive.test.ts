import { describe, it, expect } from "vitest";
import {
  CHROME_CHIP,
  CHROME_DESTRUCTIVE_ICON,
  CHROME_HOVER,
  CHROME_ICON_BTN,
  CHROME_ICON_BTN_MD,
  CHROME_MENU_ITEM,
  CHROME_SEGMENT,
  CHROME_SEGMENT_INACTIVE,
  CHROME_TAB_INACTIVE,
  FOCUS_RING,
} from "@/lib/chrome-interactive";

describe("chrome-interactive class constants", () => {
  it("exports stable focus ring class", () => {
    expect(FOCUS_RING).toBe("focus-ring");
  });

  it("exports hover background class for light and dark", () => {
    expect(CHROME_HOVER).toBe("chrome-hover");
  });

  it("exports icon button classes with hover and focus affordances", () => {
    expect(CHROME_ICON_BTN).toBe("chrome-icon-btn");
    expect(CHROME_ICON_BTN_MD).toBe("chrome-icon-btn-md");
  });

  it("exports segment, chip, menu, and tab classes", () => {
    expect(CHROME_SEGMENT).toBe("chrome-segment");
    expect(CHROME_SEGMENT_INACTIVE).toBe("chrome-segment-inactive");
    expect(CHROME_CHIP).toBe("chrome-chip");
    expect(CHROME_MENU_ITEM).toBe("chrome-menu-item");
    expect(CHROME_TAB_INACTIVE).toBe("chrome-tab-inactive");
  });

  it("exports destructive icon variant", () => {
    expect(CHROME_DESTRUCTIVE_ICON).toBe("chrome-destructive-icon");
  });
});
