import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignupPageClient } from "@/app/signup/signup-form";
import * as SignupPageModule from "@/app/signup/page";

vi.mock("@/components/nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));

const signUp = vi.fn();
const push = vi.fn();
const useSearchParams = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  signUp: {
    email: (...args: unknown[]) => signUp(...args),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => useSearchParams(),
}));

describe("Signup page", () => {
  it("evaluates Google auth at request time", () => {
    expect(SignupPageModule.dynamic).toBe("force-dynamic");
  });

  beforeEach(() => {
    signUp.mockReset();
    push.mockReset();
    useSearchParams.mockReturnValue(new URLSearchParams());
    signUp.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("renders confirm password field", () => {
    render(<SignupPageClient googleEnabled={false} githubEnabled={false} orcidEnabled={false} />);

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("shows error and does not sign up when passwords differ", async () => {
    render(<SignupPageClient googleEnabled={false} githubEnabled={false} orcidEnabled={false} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    });

    expect(signUp).not.toHaveBeenCalled();
  });

  it("hides Google button when Google auth is not configured", () => {
    render(<SignupPageClient googleEnabled={false} githubEnabled={false} orcidEnabled={false} />);

    expect(screen.queryByRole("button", { name: "Continue with Google" })).not.toBeInTheDocument();
  });

  it("shows Google button when Google auth is configured", () => {
    render(<SignupPageClient googleEnabled={true} githubEnabled={false} orcidEnabled={false} />);

    const button = screen.getByRole("button", { name: "Continue with Google" });
    expect(button).toBeInTheDocument();
    expect(button.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  });

  it("hides GitHub button when GitHub auth is not configured", () => {
    render(<SignupPageClient googleEnabled={false} githubEnabled={false} orcidEnabled={false} />);

    expect(screen.queryByRole("button", { name: "Continue with GitHub" })).not.toBeInTheDocument();
  });

  it("shows GitHub button when GitHub auth is configured", () => {
    render(<SignupPageClient googleEnabled={false} githubEnabled={true} orcidEnabled={false} />);

    const button = screen.getByRole("button", { name: "Continue with GitHub" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("cursor-pointer");
    expect(button.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  });

  it("hides ORCID button when ORCID auth is not configured", () => {
    render(<SignupPageClient googleEnabled={false} githubEnabled={false} orcidEnabled={false} />);

    expect(screen.queryByRole("button", { name: "Continue with ORCID" })).not.toBeInTheDocument();
  });

  it("shows ORCID button when ORCID auth is configured", () => {
    render(<SignupPageClient googleEnabled={false} githubEnabled={false} orcidEnabled={true} />);

    const button = screen.getByRole("button", { name: "Continue with ORCID" });
    expect(button).toBeInTheDocument();
    expect(button.querySelector("svg[aria-hidden='true'] path[fill='#A6CE39']")).toBeInTheDocument();
  });

  it("toggles password visibility for password and confirm fields", () => {
    render(<SignupPageClient googleEnabled={false} githubEnabled={false} orcidEnabled={false} />);

    const password = screen.getByLabelText("Password");
    const confirmPassword = screen.getByLabelText("Confirm password");
    expect(password).toHaveAttribute("type", "password");
    expect(confirmPassword).toHaveAttribute("type", "password");

    const [passwordToggle, confirmToggle] = screen.getAllByRole("button", { name: "Show password" });
    fireEvent.click(passwordToggle);
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getAllByRole("button", { name: "Hide password" })[0]);
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(confirmToggle);
    expect(confirmPassword).toHaveAttribute("type", "text");
    fireEvent.click(screen.getAllByRole("button", { name: "Hide password" })[0]);
    expect(confirmPassword).toHaveAttribute("type", "password");
  });

  it("redirects to next path after signup when provided", async () => {
    useSearchParams.mockReturnValue(new URLSearchParams("next=/invite/invite-1"));

    render(<SignupPageClient googleEnabled={false} githubEnabled={false} orcidEnabled={false} />);

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/invite/invite-1");
    });
  });

  it("links to login with the same next path", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("next=/invite/invite-1"));

    render(<SignupPageClient googleEnabled={false} githubEnabled={false} orcidEnabled={false} />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Finvite%2Finvite-1"
    );
  });
});
