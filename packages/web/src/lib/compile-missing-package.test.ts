import { describe, expect, it } from "vitest";
import {
  analyzeCompileMissingPackage,
  detectUndefinedCommands,
  getAllowedPackagesForCompileErrors,
  parseMissingStyPackage,
} from "./compile-missing-package";

describe("parseMissingStyPackage", () => {
  it("parses File `foo.sty' not found", () => {
    expect(parseMissingStyPackage("! LaTeX Error: File `minted.sty' not found.")).toBe("minted");
  });
});

describe("getAllowedPackagesForCompileErrors", () => {
  it("allows natbib for citep and graphicx for includegraphics", () => {
    expect(
      getAllowedPackagesForCompileErrors([
        { message: "template.tex:64: Undefined control sequence. \\citep" },
      ])
    ).toEqual(["natbib"]);
    expect(
      getAllowedPackagesForCompileErrors([
        { message: "main.tex:12: Undefined control sequence. \\includegraphics" },
      ])
    ).toEqual(["graphicx"]);
    expect(
      getAllowedPackagesForCompileErrors([
        { message: "main.tex:8: Undefined control sequence. \\SI" },
      ])
    ).toEqual(["siunitx"]);
  });

  it("rejects unknown invented packages", () => {
    expect(
      getAllowedPackagesForCompileErrors([
        { message: "main.tex:3: Undefined control sequence. \\fooBarBaz" },
      ])
    ).toEqual([]);
  });
});

describe("analyzeCompileMissingPackage", () => {
  it("returns available when in-image package is needed", () => {
    expect(
      analyzeCompileMissingPackage({
        errors: [{ message: "main.tex:5: Undefined control sequence. \\citep" }],
      })
    ).toEqual({ kind: "available", packages: ["natbib"] });
  });

  it("stops for sty not in compiler image", () => {
    expect(
      analyzeCompileMissingPackage({
        errors: [{ message: "LaTeX Error: File `minted.sty' not found." }],
      })
    ).toEqual({ kind: "missing_compiler_package", package: "minted" });
  });

  it("stops for unmapped undefined command", () => {
    expect(
      analyzeCompileMissingPackage({
        errors: [{ message: "Undefined control sequence. \\customMacro" }],
      })
    ).toEqual({
      kind: "missing_compiler_package",
      package: "customMacro",
      command: "customMacro",
    });
  });
});

describe("detectUndefinedCommands", () => {
  it("keeps PAP-41 citep/citet detection", () => {
    expect(
      detectUndefinedCommands([{ message: "template.tex:64: Undefined control sequence. \\citep" }])
    ).toEqual(["citep"]);
    expect(
      detectUndefinedCommands([{ message: "Undefined control sequence. l.12 \\citet{smith}" }])
    ).toEqual(["citet"]);
  });
});
