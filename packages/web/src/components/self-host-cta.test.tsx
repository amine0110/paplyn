import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SelfHostCta } from "@/components/self-host-cta";
import { GITHUB_REPO_URL } from "@/lib/product";

describe("SelfHostCta", () => {
  it("links to GitHub and configuration docs in hero variant", () => {
    render(<SelfHostCta variant="hero" />);

    const github = screen.getByRole("link", { name: "Self-host on GitHub" });
    expect(github).toHaveAttribute("href", GITHUB_REPO_URL);
    expect(github).toHaveAttribute("target", "_blank");

    expect(screen.getByRole("link", { name: "Configuration guide" })).toHaveAttribute(
      "href",
      "/docs/configuration"
    );
  });
});
