import { describe, expect, it } from "vitest";
import {
  mergeCompileDiagnostics,
  parseCompileDiagnosticsFromLog,
} from "./compile-log-diagnostics";

describe("parseCompileDiagnosticsFromLog", () => {
  it("parses LaTeX, package, overfull, and undefined-reference warnings", () => {
    const log = [
      "LaTeX Warning: Citation `smith2020' on page 1 undefined on input line 42.",
      "Package hyperref Warning: Token not allowed in a PDF string (Unicode):",
      "Overfull \\hbox (12.3pt too wide) in paragraph at lines 10--11",
      "There were undefined references.",
    ].join("\n");

    const parsed = parseCompileDiagnosticsFromLog(log, "main.tex");
    expect(parsed.some((entry) => entry.message.includes("Citation `smith2020'"))).toBe(true);
    expect(parsed.some((entry) => entry.message.includes("Package hyperref Warning"))).toBe(true);
    expect(parsed.some((entry) => entry.message.includes("Overfull \\hbox"))).toBe(true);
    expect(parsed.some((entry) => entry.message.includes("undefined references"))).toBe(true);
    expect(parsed.find((entry) => entry.message.includes("Overfull"))?.line).toBe(10);
  });
});

describe("mergeCompileDiagnostics", () => {
  it("adds log-only warnings to structured errors", () => {
    const log = "Package natbib Warning: Citation `foo' undefined.";
    const merged = mergeCompileDiagnostics([], log);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.message).toContain("Citation `foo' undefined");
  });

  it("dedupes identical diagnostics from errors and log", () => {
    const entry = {
      message: "Citation `foo' on page 1 undefined",
      severity: "warning" as const,
    };
    const merged = mergeCompileDiagnostics([entry], `LaTeX Warning: ${entry.message}`);
    expect(merged).toHaveLength(1);
  });
});
