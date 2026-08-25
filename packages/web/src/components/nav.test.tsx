import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Nav } from "@/components/nav";

const signOutAndLeave = vi.hoisted(() => vi.fn());
const useSession = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/lib/auth-redirect", () => ({
  signOutAndLeave,
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
}));

describe("Nav", () => {
  beforeEach(() => {
    signOutAndLeave.mockReset();
    useSession.mockReturnValue({ data: null, isPending: false });
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
  });

  it("renders a theme group in the top bar", () => {
    render(
      <ThemeProvider>
        <Nav />
      </ThemeProvider>
    );

    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Theme: /i })).toBeInTheDocument();
  });

  it("sign out leaves the app via a hard redirect helper", () => {
    useSession.mockReturnValue({
      data: { user: { id: "u1", email: "a@b.com", name: "A" } },
      isPending: false,
    });

    render(
      <ThemeProvider>
        <Nav />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOutAndLeave).toHaveBeenCalledOnce();
  });
});
