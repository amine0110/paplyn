import React, { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UiFeedbackProvider, useUiFeedback } from "@/components/ui-feedback";

function NoticeProbe({
  noticeArg,
}: {
  noticeArg: string | { message: string; variant?: "error" | "success" | "info" };
}) {
  const { notice } = useUiFeedback();

  useEffect(() => {
    notice(noticeArg);
  }, [notice, noticeArg]);

  return null;
}

describe("UiFeedback notice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults string notices to info styling", () => {
    render(
      <UiFeedbackProvider>
        <NoticeProbe noticeArg="Saved draft" />
      </UiFeedbackProvider>
    );

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("Saved draft");
    expect(toast).toHaveClass("text-ink");
    expect(toast).not.toHaveClass("text-error");
    expect(toast).not.toHaveClass("text-accent");
  });

  it("shows cite success with success styling", () => {
    render(
      <UiFeedbackProvider>
        <NoticeProbe
          noticeArg={{
            message: 'Cited "Attention Is All You Need" (arXiv)',
            variant: "success",
          }}
        />
      </UiFeedbackProvider>
    );

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent('Cited "Attention Is All You Need" (arXiv)');
    expect(toast).toHaveClass("text-accent");
    expect(toast).not.toHaveClass("text-error");
  });

  it("keeps explicit error variant for failures", () => {
    render(
      <UiFeedbackProvider>
        <NoticeProbe noticeArg={{ message: "Could not resolve DOI", variant: "error" }} />
      </UiFeedbackProvider>
    );

    const toast = screen.getByRole("alert");
    expect(toast).toHaveTextContent("Could not resolve DOI");
    expect(toast).toHaveClass("text-error");
    expect(toast).not.toHaveClass("text-accent");
  });
});
