import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeCompileMissingPackage,
  getAllowedPackagesForCompileErrors,
} from "@/lib/compile-missing-package";
import { buildMissingCompilerPackageUserMessage } from "@/lib/compile-fix-missing-package-message";
import { decideCompileFixAutoRetry, createCompileFixRetrySession } from "@/lib/compile-fix-auto-retry";
import { COMPILE_FIX_WORKSPACE_SUFFIX } from "@/lib/ai-plugins/workspace-tools";
import { validateNoInventedPackages } from "@/lib/ai-compile-fix-validation";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-42 generalized compile-fix missing-package handling", () => {
  it("allows natbib and siunitx for mapped undefined commands", () => {
    expect(
      getAllowedPackagesForCompileErrors([
        { message: "main.tex:4: Undefined control sequence. \\citep" },
      ])
    ).toEqual(["natbib"]);
    expect(
      getAllowedPackagesForCompileErrors([
        { message: "main.tex:9: Undefined control sequence. \\SI" },
      ])
    ).toEqual(["siunitx"]);
  });

  it("rejects unknown packages and stops auto-retry for missing compiler packages", () => {
    expect(
      validateNoInventedPackages(
        ["\\usepackage{amsmath}"],
        "\\usepackage{amsmath}\n\\usepackage{notapaplynpackage}",
        { compileErrors: [{ message: "Undefined control sequence. \\citep" }] }
      )
    ).toMatchObject({
      ok: false,
      missingCompilerPackage: "notapaplynpackage",
    });

    const session = createCompileFixRetrySession();
    session.active = true;
    session.awaitingPostFixCompile = true;
    expect(
      decideCompileFixAutoRetry(session, 1, "fp", {
        errors: [{ message: "LaTeX Error: File `minted.sty' not found." }],
      })
    ).toEqual({ shouldRetry: false, reason: "missing_compiler_package" });
  });

  it("user-facing missing-package copy is plain English with /report link", () => {
    const message = buildMissingCompilerPackageUserMessage({
      packageName: "minted",
      command: "minted",
      page: "/project/x",
    });
    expect(message).toMatch(/needs the LaTeX package.*minted/i);
    expect(message).toMatch(/Request this package/);
    expect(message).not.toMatch(/retry_used/i);
  });

  it("compile-fix suffix mentions in-image packages beyond natbib", () => {
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toMatch(/graphicx|siunitx|natbib/i);
    expect(COMPILE_FIX_WORKSPACE_SUFFIX).toMatch(/installed on Paplyn/i);
  });

  it("wires missing-package stop through AI route and sidebar", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("analyzeCompileMissingPackage");
    expect(routeSrc).toContain("compileFixStopRetry");
    expect(routeSrc).toContain("buildMissingCompilerPackageUserMessage");

    const sidebarSrc = readSrc("components/ai-sidebar.tsx");
    expect(sidebarSrc).toContain("compileFixStopRetry");
  });

  it("analyzeCompileMissingPackage distinguishes available vs missing", () => {
    expect(
      analyzeCompileMissingPackage({
        errors: [{ message: "Undefined control sequence. \\citep" }],
      }).kind
    ).toBe("available");
    expect(
      analyzeCompileMissingPackage({
        errors: [{ message: "LaTeX Error: File `notapaplynpackage.sty' not found." }],
      }).kind
    ).toBe("missing_compiler_package");
  });
});
