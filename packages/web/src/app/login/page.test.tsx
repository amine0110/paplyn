import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoginPageClient } from "@/app/login/login-form";
import * as LoginPageModule from "@/app/login/page";

vi.mock("@/components/nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));

vi.mock("@/lib/auth-client", () => ({
  signIn: {
    email: vi.fn(),
    social: vi.fn(),
  },
}));

const useSearchParams = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => useSearchParams(),
}));

describe("Login page", () => {
  beforeEach(() => {
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("evaluates Google auth at request time", () => {
    expect(LoginPageModule.dynamic).toBe("force-dynamic");
  });

  it("renders forgot password link", () => {
    render(<LoginPageClient googleEnabled={false} githubEnabled={false} />);

    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password"
    );
  });

  it("hides Google button when Google auth is not configured", () => {
    render(<LoginPageClient googleEnabled={false} githubEnabled={false} />);

    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
  });

  it("shows Google button when Google auth is configured", () => {
    render(<LoginPageClient googleEnabled={true} githubEnabled={false} />);

    const button = screen.getByRole("button", { name: "Continue with Google" });
    expect(button).toBeInTheDocument();
    expect(button.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  });

  it("hides GitHub button when GitHub auth is not configured", () => {
    render(<LoginPageClient googleEnabled={false} githubEnabled={false} />);

    expect(screen.queryByRole("button", { name: "Continue with GitHub" })).not.toBeInTheDocument();
  });

  it("shows GitHub button when GitHub auth is configured", () => {
    render(<LoginPageClient googleEnabled={false} githubEnabled={true} />);

    const button = screen.getByRole("button", { name: "Continue with GitHub" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("cursor-pointer");
    expect(button.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  });

  it("toggles password visibility", () => {
    render(<LoginPageClient googleEnabled={false} githubEnabled={false} />);

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Show password" });
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("links to signup with the same next path", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("next=/invite/invite-1"));

    render(<LoginPageClient googleEnabled={false} githubEnabled={false} />);

    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute(
      "href",
      "/signup?next=%2Finvite%2Finvite-1"
    );
  });
});
