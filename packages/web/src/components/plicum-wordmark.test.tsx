import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlicumWordmark } from "@/components/plicum-wordmark";
import { PRODUCT_NAME } from "@/lib/product";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt ?? ""} />
  ),
}));

describe("PlicumWordmark", () => {
  it("hides the product name below sm to avoid mid-word clipping", () => {
    render(<PlicumWordmark className="h-10" />);

    const name = screen.getByText(PRODUCT_NAME);
    expect(name).toHaveClass("hidden", "sm:inline");
    expect(name).toHaveClass("whitespace-nowrap", "shrink-0");
  });

  it("keeps an accessible label on the lockup when the name is hidden", () => {
    render(<PlicumWordmark className="h-10" />);

    expect(screen.getByLabelText(PRODUCT_NAME)).toBeInTheDocument();
  });

  it("can always show the name when showName is set", () => {
    render(<PlicumWordmark className="h-10" showName />);

    const name = screen.getByText(PRODUCT_NAME);
    expect(name).not.toHaveClass("hidden");
  });
});
