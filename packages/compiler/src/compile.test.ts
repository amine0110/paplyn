import { describe, it, expect } from "vitest";
import { extractToolErrors } from "./compile.js";

describe("extractToolErrors", () => {
  it("detects spawn ENOENT failures", () => {
    const errors = extractToolErrors("\n--- pdflatex pass 1 ---\n\nspawn pdflatex ENOENT");
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].message).toContain("pdflatex");
    expect(errors[0].message).toContain("not found");
  });

  it("returns no errors for normal LaTeX log output", () => {
    const errors = extractToolErrors("This is pdfTeX, Version 3.141592653\nOutput written on main.pdf");
    expect(errors).toHaveLength(0);
  });
});
