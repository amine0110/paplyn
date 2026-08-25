import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingHero } from "@/components/landing-hero";

const useSession = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
}));

describe("LandingHero", () => {
  beforeEach(() => {
    useSession.mockReturnValue({ data: null });
  });

  it("links logged-out users to signup and login", () => {
    render(<LandingHero />);

    expect(screen.getByRole("link", { name: "Start writing" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
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
