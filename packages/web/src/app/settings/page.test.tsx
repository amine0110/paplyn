import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SettingsPage from "@/app/settings/page";

const useRequireSession = vi.fn();

vi.mock("@/lib/use-require-session", () => ({
  useRequireSession: () => useRequireSession(),
}));

vi.mock("@/components/nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div>Theme</div>,
}));

vi.mock("@/lib/config", () => ({
  config: { isSaas: false },
}));

describe("SettingsPage session guard", () => {
  beforeEach(() => {
    useRequireSession.mockReset();
  });

  it("does not render private profile fields when unauthenticated", () => {
    useRequireSession.mockReturnValue({
      session: null,
      isPending: false,
      isAuthenticated: false,
    });

    render(<SettingsPage />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
  });

  it("renders profile fields when authenticated", () => {
    useRequireSession.mockReturnValue({
      session: { user: { id: "u1", email: "user@example.com", name: "User" } },
      isPending: false,
      isAuthenticated: true,
    });

    render(<SettingsPage />);

    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("user@example.com");
  });
});
