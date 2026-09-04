import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CompilePanel } from "@/components/compile-panel";
import { COMPILE_PANEL_COLLAPSED_KEY } from "@/lib/compile-panel-preferences";

vi.mock("next/navigation", () => ({
  usePathname: () => "/project/test",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/report-detected-error", () => ({
  reportDetectedError: vi.fn().mockResolvedValue({ sent: false }),
}));

const SAMPLE_WARNINGS = [
  { severity: "warning" as const, line: 12, message: "Reference 'tab:foo' undefined" },
  { severity: "warning" as const, line: 18, message: "Reference 'fig:bar' undefined" },
];

const SAMPLE_ERRORS = [
  { severity: "error" as const, line: 42, message: "Undefined control sequence \\foo" },
];

describe("CompilePanel collapse", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the error list by default and hides it when collapsed", () => {
    render(
      <CompilePanel
        log=""
        errors={SAMPLE_WARNINGS}
        onJumpToLine={vi.fn()}
        showLog={false}
        onToggleLog={vi.fn()}
      />,
    );

    expect(screen.getByText(/Reference 'tab:foo' undefined/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse compile panel" }));
    expect(screen.queryByText(/Reference 'tab:foo' undefined/)).not.toBeInTheDocument();
    expect(screen.getByText(/2 warnings/)).toBeInTheDocument();
    expect(localStorage.getItem(COMPILE_PANEL_COLLAPSED_KEY)).toBe("true");
  });

  it("restores the list when expanded again", () => {
    localStorage.setItem(COMPILE_PANEL_COLLAPSED_KEY, "true");

    render(
      <CompilePanel
        log=""
        errors={SAMPLE_WARNINGS}
        onJumpToLine={vi.fn()}
        showLog={false}
        onToggleLog={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Reference 'tab:foo' undefined/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand compile panel" }));
    expect(screen.getByText(/Reference 'tab:foo' undefined/)).toBeInTheDocument();
    expect(localStorage.getItem(COMPILE_PANEL_COLLAPSED_KEY)).toBe("false");
  });

  it("auto-expands when new hard errors appear after compile", () => {
    localStorage.setItem(COMPILE_PANEL_COLLAPSED_KEY, "true");

    const { rerender } = render(
      <CompilePanel
        log=""
        errors={SAMPLE_WARNINGS}
        onJumpToLine={vi.fn()}
        showLog={false}
        onToggleLog={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Undefined control sequence/)).not.toBeInTheDocument();

    rerender(
      <CompilePanel
        log=""
        errors={[...SAMPLE_WARNINGS, ...SAMPLE_ERRORS]}
        onJumpToLine={vi.fn()}
        showLog={false}
        onToggleLog={vi.fn()}
      />,
    );

    expect(screen.getByText(/Undefined control sequence/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse compile panel" })).toBeInTheDocument();
    expect(localStorage.getItem(COMPILE_PANEL_COLLAPSED_KEY)).toBe("false");
  });

  it("keeps the panel collapsed when only warnings refresh", () => {
    localStorage.setItem(COMPILE_PANEL_COLLAPSED_KEY, "true");

    const { rerender } = render(
      <CompilePanel
        log=""
        errors={SAMPLE_WARNINGS}
        onJumpToLine={vi.fn()}
        showLog={false}
        onToggleLog={vi.fn()}
      />,
    );

    rerender(
      <CompilePanel
        log=""
        errors={[
          { severity: "warning", line: 99, message: "Reference 'tab:new' undefined" },
        ]}
        onJumpToLine={vi.fn()}
        showLog={false}
        onToggleLog={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Reference 'tab:new' undefined/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand compile panel" })).toBeInTheDocument();
    expect(localStorage.getItem(COMPILE_PANEL_COLLAPSED_KEY)).toBe("true");
  });
});
