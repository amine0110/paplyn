import { describe, expect, it } from "vitest";
import {
  computeAiSidebarDragWidth,
  createAiSidebarDragSession,
} from "@/lib/ai-sidebar-resize";
import {
  AI_SIDEBAR_WIDTH_MAX,
  AI_SIDEBAR_WIDTH_MIN,
} from "@/lib/ui-preferences";

describe("ai-sidebar-resize", () => {
  it("widens the panel when dragging the handle left", () => {
    expect(computeAiSidebarDragWidth(500, 400, 380)).toBe(480);
  });

  it("narrows the panel when dragging the handle right", () => {
    expect(computeAiSidebarDragWidth(500, 600, 380)).toBe(280);
  });

  it("clamps to the full 280–560px range", () => {
    expect(computeAiSidebarDragWidth(100, -80, 380)).toBe(AI_SIDEBAR_WIDTH_MAX);
    expect(computeAiSidebarDragWidth(100, 200, 380)).toBe(AI_SIDEBAR_WIDTH_MIN);
    expect(computeAiSidebarDragWidth(500, 400, 380)).toBe(480);
    expect(computeAiSidebarDragWidth(500, 900, 380)).toBe(AI_SIDEBAR_WIDTH_MIN);
  });

  it("returns the latest dragged width on end, not the start width", () => {
    const session = createAiSidebarDragSession(500, 380);
    expect(session.move(450)).toBe(430);
    expect(session.move(350)).toBe(530);
    expect(session.end()).toBe(530);
    expect(session.end()).not.toBe(380);
  });
});
