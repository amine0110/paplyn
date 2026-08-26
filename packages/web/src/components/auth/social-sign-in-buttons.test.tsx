// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GitHubSignInButton } from "@/components/auth/github-sign-in-button";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const signOutAndStartSocialSignIn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-social", () => ({
  signOutAndStartSocialSignIn,
}));

describe("social sign-in buttons", () => {
  beforeEach(() => {
    signOutAndStartSocialSignIn.mockReset();
    signOutAndStartSocialSignIn.mockResolvedValue(undefined);
  });

  it("GitHub button starts fresh social sign-in with error callback", async () => {
    render(
      <GitHubSignInButton
        callbackURL="/dashboard"
        errorCallbackURL="/login?error=oauth"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));

    await waitFor(() => {
      expect(signOutAndStartSocialSignIn).toHaveBeenCalledWith({
        provider: "github",
        callbackURL: "/dashboard",
        errorCallbackURL: "/login?error=oauth",
      });
    });
  });

  it("Google button starts fresh social sign-in with error callback", async () => {
    render(
      <GoogleSignInButton
        callbackURL="/invite/abc"
        errorCallbackURL="/signup?error=oauth"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(signOutAndStartSocialSignIn).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/invite/abc",
        errorCallbackURL: "/signup?error=oauth",
      });
    });
  });
});
