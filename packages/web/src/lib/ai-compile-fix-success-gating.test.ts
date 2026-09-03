import { describe, expect, it } from "vitest";
import {
  claimsCompileFixSuccess,
  sanitizeCompileFixSuccessClaims,
} from "./ai-compile-fix-success-gating";

describe("claimsCompileFixSuccess", () => {
  it("detects common premature fix claims", () => {
    expect(claimsCompileFixSuccess("The issue is fixed now.")).toBe(true);
    expect(claimsCompileFixSuccess("I've fixed the references problem.")).toBe(true);
    expect(claimsCompileFixSuccess("The compile errors are resolved.")).toBe(true);
    expect(claimsCompileFixSuccess("This should compile successfully now.")).toBe(true);
  });

  it("does not flag honest recompile guidance", () => {
    expect(
      claimsCompileFixSuccess("I applied the change. Recompile to check whether errors remain.")
    ).toBe(false);
    expect(claimsCompileFixSuccess("Changed main.tex line 42.")).toBe(false);
  });
});

describe("sanitizeCompileFixSuccessClaims", () => {
  it("replaces success claims when compile errors remain and no post-edit compile proof", () => {
    const result = sanitizeCompileFixSuccessClaims("I've fixed the references issue.", {
      compileFixRequest: true,
      appliedEditCount: 1,
      compileErrorCount: 3,
      postEditCompileKnown: false,
    });
    expect(result).not.toMatch(/fixed the references/i);
    expect(result).toMatch(/recompile/i);
  });

  it("replaces success claims on auto-retry when post-edit compile still has errors", () => {
    const result = sanitizeCompileFixSuccessClaims("The compile errors are resolved.", {
      compileFixRequest: true,
      appliedEditCount: 1,
      compileErrorCount: 2,
      postEditCompileKnown: true,
    });
    expect(result).toMatch(/last compile still reported errors/i);
    expect(result).not.toMatch(/resolved/i);
  });

  it("leaves non-compile-fix content unchanged", () => {
    const text = "The issue is fixed now.";
    expect(
      sanitizeCompileFixSuccessClaims(text, {
        compileFixRequest: false,
        appliedEditCount: 1,
        compileErrorCount: 0,
      })
    ).toBe(text);
  });

  it("allows success claims only after a clean post-edit compile", () => {
    const text = "The compile errors are resolved.";
    expect(
      sanitizeCompileFixSuccessClaims(text, {
        compileFixRequest: true,
        appliedEditCount: 1,
        compileErrorCount: 0,
        postEditCompileKnown: true,
      })
    ).toBe(text);
  });
});
