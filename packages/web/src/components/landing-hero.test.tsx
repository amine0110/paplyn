import React from "react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingHero } from "@/components/landing-hero";
import { GITHUB_REPO_URL } from "@/lib/product";

const useSession = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
}));

describe("LandingHero", () => {
  const originalSignups = process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED;

  beforeEach(() => {
    useSession.mockReturnValue({ data: null });
    process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED = "true";
  });

  afterEach(() => {
    if (originalSignups === undefined) {
      delete process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED = originalSignups;
    }
  });

  it("links logged-out users to signup and login when signups are enabled", () => {
    render(<LandingHero />);

    expect(screen.getByRole("link", { name: "Start writing" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  it("shows self-host CTAs when signups are disabled", () => {
    process.env.NEXT_PUBLIC_PUBLIC_SIGNUPS_ENABLED = "false";

    render(<LandingHero />);

    expect(screen.getByRole("link", { name: "Self-host on GitHub" })).toHaveAttribute(
      "href",
      GITHUB_REPO_URL
    );
    expect(screen.getByRole("link", { name: "Configuration guide" })).toHaveAttribute(
      "href",
      "/docs/configuration"
    );
    expect(screen.queryByRole("link", { name: "Start writing" })).not.toBeInTheDocument();
  });

  it("links logged-in users to the dashboard", () => {
    useSession.mockReturnValue({
      data: { user: { id: "user-1", email: "ada@example.com", name: "Ada" } },
    });

    render(<LandingHero />);

    expect(screen.getByRole("link", { name: "Open projects" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
