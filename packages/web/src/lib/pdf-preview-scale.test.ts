// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDefaultPdfScale } from "@/lib/pdf-preview-scale";

describe("getDefaultPdfScale", () => {
  const matchMediaMock = vi.fn();

  beforeEach(() => {
    matchMediaMock.mockReset();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: matchMediaMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 0.5 on narrow viewports (mobile)", () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query === "(max-width: 639px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(getDefaultPdfScale()).toBe(0.5);
  });

  it("returns 0.95 on desktop viewports", () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(getDefaultPdfScale()).toBe(0.95);
  });
});
