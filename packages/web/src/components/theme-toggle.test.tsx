import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    localStorage.clear();
  });

  function renderToggle() {
    return render(
      <ThemeProvider>
        <ThemeToggle compact />
      </ThemeProvider>
    );
  }

  it("renders a single cycling control on small screens and a segment group on md+", () => {
    renderToggle();

    expect(screen.getByRole("button", { name: /Theme: System/i })).toHaveClass("md:hidden");
    expect(screen.getByRole("group", { name: "Theme" })).toHaveClass("hidden", "md:inline-flex");
  });

  it("cycles system → light → dark → system from the mobile control", () => {
    renderToggle();

    const cycleButton = screen.getByRole("button", { name: /Theme: System/i });
    fireEvent.click(cycleButton);
    expect(screen.getByRole("button", { name: /Theme: Light/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Theme: Light/i }));
    expect(screen.getByRole("button", { name: /Theme: Dark/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Theme: Dark/i }));
    expect(screen.getByRole("button", { name: /Theme: System/i })).toBeInTheDocument();
  });
});
