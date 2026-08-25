import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ForgotPasswordPage from "@/app/forgot-password/page";

vi.mock("@/components/nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));

const requestPasswordReset = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
}));

describe("Forgot password page", () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
    requestPasswordReset.mockResolvedValue({ data: { status: true } });
  });

  it("renders email field and submit button", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
  });

  it("shows calm success copy that does not reveal whether the email exists", async () => {
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "unknown@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "If that email has an account, we sent a reset link"
      );
    });

    expect(screen.getByRole("status")).not.toHaveTextContent("not found");
    expect(screen.getByRole("status")).not.toHaveTextContent("no account");
    expect(screen.getByRole("status")).not.toHaveTextContent("does not exist");
  });
});
