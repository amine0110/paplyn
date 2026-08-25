import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ResetPasswordPage from "@/app/reset-password/page";

vi.mock("@/components/nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));

const resetPassword = vi.fn();
const push = vi.fn();

vi.mock("@/lib/auth-client", () => ({
  resetPassword: (...args: unknown[]) => resetPassword(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("token=valid-token"),
}));

describe("Reset password page", () => {
  beforeEach(() => {
    resetPassword.mockReset();
    push.mockReset();
    resetPassword.mockResolvedValue({ data: { status: true } });
  });

  it("renders new password and confirm password fields", () => {
    render(<ResetPasswordPage />);

    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update password" })).toBeInTheDocument();
  });

  it("rejects mismatched passwords before calling resetPassword", async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different123" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    });

    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("submits reset when passwords match", async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        newPassword: "password123",
        token: "valid-token",
      });
    });
  });
});
