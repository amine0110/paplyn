import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { DocsShell } from "@/components/docs/docs-shell";
import type { DocSection } from "@/lib/docs/types";

const useSession = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt ?? ""} />
  ),
}));

vi.mock("@/lib/auth-redirect", () => ({
  signOutAndLeave: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
}));

const sections: DocSection[] = [];

function renderDocsShell() {
  return render(
    <ThemeProvider>
      <DocsShell sections={sections}>
        <p>Doc body</p>
      </DocsShell>
    </ThemeProvider>
  );
}

describe("DocsShell", () => {
  beforeEach(() => {
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

  it("shows Sign in and Get started when signed out", () => {
    renderDocsShell();

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/signup");
    expect(screen.queryByRole("link", { name: "Projects" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("shows Projects, Settings, and Sign out when signed in", () => {
    useSession.mockReturnValue({
      data: { user: { id: "u1", email: "a@b.com", name: "A" } },
      isPending: false,
    });

    renderDocsShell();

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Get started" })).not.toBeInTheDocument();
  });
});
