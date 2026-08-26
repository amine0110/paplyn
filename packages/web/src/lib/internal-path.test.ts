import { describe, it, expect } from "vitest";
import { isInternalAppPath, resolveInternalNextPath } from "@/lib/internal-path";

describe("internal-path", () => {
  it("accepts single-slash internal paths", () => {
    expect(isInternalAppPath("/dashboard")).toBe(true);
    expect(isInternalAppPath("/invite/abc")).toBe(true);
    expect(resolveInternalNextPath("/settings")).toBe("/settings");
  });

  it("rejects protocol-relative open redirects", () => {
    expect(isInternalAppPath("//evil.example")).toBe(false);
    expect(resolveInternalNextPath("//evil.example")).toBe("/dashboard");
    expect(resolveInternalNextPath("//evil.example/phish")).toBe("/dashboard");
  });

  it("falls back for external and malformed paths", () => {
    expect(resolveInternalNextPath("https://evil.example")).toBe("/dashboard");
    expect(resolveInternalNextPath(undefined)).toBe("/dashboard");
    expect(resolveInternalNextPath(null)).toBe("/dashboard");
  });
});
