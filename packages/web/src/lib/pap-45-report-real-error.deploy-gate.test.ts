import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCompileFixAiRequest,
  COMPILE_FIX_MESSAGE_LEAD_IN,
  COMPILE_FIX_USER_MESSAGE,
} from "@/lib/ai-compile-fix-intent";
import { buildCompileFailureReportMessage } from "@/lib/compile-failure-report-message";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-45 report real on-screen error deploy gate", () => {
  it("uses shared compile failure report message helper in error surfaces", () => {
    expect(existsSync(join(ROOT, "lib/compile-failure-report-message.ts"))).toBe(true);

    const compilePanel = readSrc("components/compile-panel.tsx");
    expect(compilePanel).toContain("buildCompileFailureReportMessage");
    expect(compilePanel).not.toContain("COMPILE_FIX_USER_MESSAGE");

    const pdfPreview = readSrc("components/pdf-preview.tsx");
    expect(pdfPreview).toContain("buildCompileFailureReportMessage");
    expect(pdfPreview).not.toContain("COMPILE_FIX_USER_MESSAGE");

    const reportHelper = readSrc("lib/report-detected-error.ts");
    expect(reportHelper).toContain("resolveReportWhatHappenedMessage");
  });

  it("prefills project chrome Report links with compile errors when present", () => {
    const projectPage = readSrc("app/project/[id]/page.tsx");
    expect(projectPage).toContain("ProjectReportLink");
    expect(projectPage).toContain("compileErrors={compileErrors}");
    expect(projectPage).toContain("compileLog={compileLog}");
  });

  it("buildCompileFailureReportMessage never returns the compile-fix AI chip prompt", () => {
    const message = buildCompileFailureReportMessage({
      errors: [{ severity: "error", line: 7, message: "Missing $ inserted" }],
      log: "ignored",
    });

    expect(message).toContain("Missing $ inserted");
    expect(message).not.toBe(COMPILE_FIX_USER_MESSAGE);
  });

  it("Fix-with-AI chat messages quote on-screen compile errors", () => {
    const errors = [{ severity: "error" as const, line: 7, message: "Missing $ inserted" }];
    const message = buildCompileFixAiRequest({ errors }).message;

    expect(message).toContain(COMPILE_FIX_MESSAGE_LEAD_IN);
    expect(message).toContain("Missing $ inserted");
    expect(message).not.toBe(COMPILE_FIX_USER_MESSAGE);
  });
});
