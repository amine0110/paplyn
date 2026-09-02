import { describe, expect, it } from "vitest";
import {
  buildMissingCompilerPackageUserMessage,
  buildPackageAddedUserMessage,
} from "./compile-fix-missing-package-message";

describe("compile-fix missing package user messages", () => {
  it("uses plain English without retry_used", () => {
    const message = buildMissingCompilerPackageUserMessage({
      packageName: "minted",
      page: "/project/abc",
    });
    expect(message).toContain("minted");
    expect(message).toMatch(/isn't installed on Paplyn yet/i);
    expect(message).not.toContain("retry_used");
    expect(message).toMatch(/\[Request this package\]\(\/report\?/);
  });

  it("describes added in-image package in plain language", () => {
    expect(
      buildPackageAddedUserMessage({ packageName: "natbib", commands: ["citep"] })
    ).toBe("Added the natbib package so \\citep works.");
    expect(buildPackageAddedUserMessage({ packageName: "graphicx" })).toBe(
      "Added the graphicx package to fix the compile error."
    );
  });
});
