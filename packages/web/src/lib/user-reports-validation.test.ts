import { describe, expect, it } from "vitest";
import {
  buildReportPageBody,
  sanitizeUserReportInput,
  userReportBodySchema,
} from "@/lib/user-reports-validation";

describe("userReportBodySchema", () => {
  it("rejects empty title and oversized fields", () => {
    const missingTitle = userReportBodySchema.safeParse({
      title: "",
      whatHappened: "Something broke",
    });
    expect(missingTitle.success).toBe(false);

    const longTitle = userReportBodySchema.safeParse({
      title: "x".repeat(121),
      whatHappened: "ok",
    });
    expect(longTitle.success).toBe(false);
  });

  it("accepts optional email for signed-out flow", () => {
    const parsed = userReportBodySchema.safeParse({
      title: "Compile failed",
      whatHappened: "PDF did not render",
      email: "user@example.com",
      source: "error",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("sanitizeUserReportInput", () => {
  it("uses session email when signed in and sanitizes text", () => {
    const parsed = userReportBodySchema.parse({
      title: "<b>Title</b>",
      whatHappened: "javascript:alert(1)",
      steps: "data:evil",
      email: "ignored@example.com",
      page: "/project/abc",
      source: "error",
    });

    const sanitized = sanitizeUserReportInput(parsed, {
      signedIn: true,
      sessionEmail: "signed@example.com",
    });

    expect(sanitized.title).toBe("Title");
    expect(sanitized.whatHappened).toBe("javascript: alert(1)");
    expect(sanitized.steps).toBe("data: evil");
    expect(sanitized.email).toBe("signed@example.com");
    expect(sanitized.source).toBe("Error");
    expect(sanitized.signedIn).toBe(true);
    expect(sanitized.receivedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("builds plain-text page body without markdown", () => {
    const body = buildReportPageBody({
      title: "Broken compile",
      whatHappened: "No PDF",
      steps: "1. Compile",
      email: null,
      page: "/project/1",
      source: "Error",
      signedIn: true,
      receivedDate: "2026-08-26",
    });

    expect(body).toContain("Broken compile");
    expect(body).toContain("What happened");
    expect(body).toContain("Steps to reproduce");
    expect(body).not.toContain("<");
  });
});
