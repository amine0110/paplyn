import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-31 auto-report deploy gate", () => {
  it("ships reportDetectedError client helper with dedup and CSRF POST", () => {
    expect(existsSync(join(ROOT, "lib/report-detected-error.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "lib/report-detected-error-dedup.ts"))).toBe(true);

    const helper = readSrc("lib/report-detected-error.ts");
    expect(helper).toContain("reportDetectedError");
    expect(helper).toContain("/api/user-reports/csrf");
    expect(helper).toContain("/api/user-reports");
    expect(helper).toContain('source: "error"');
    expect(helper).toContain("autoDetected: true");
    expect(helper).not.toContain("node:crypto");
    expect(helper).not.toMatch(/from\s+["']@\/lib\/user-reports-csrf["']/);
    expect(helper).toContain("user-reports-csrf-constants");
  });

  it("dedups detected errors for 30 minutes", () => {
    const dedup = readSrc("lib/report-detected-error-dedup.ts");
    expect(dedup).toContain("DETECTED_ERROR_DEDUP_TTL_MS");
    expect(dedup).toContain("30 * 60 * 1000");
    expect(dedup).toContain("shouldSkipDetectedErrorReport");
    expect(dedup).toContain("hashDetectedErrorDedupKey");
  });

  it("prefills /report links from error surfaces", () => {
    const url = readSrc("lib/user-reports-url.ts");
    expect(url).toContain("title");
    expect(url).toContain("what");
  });

  it("shows report CTA on error toasts", () => {
    const toast = readSrc("components/ui/toast.tsx");
    expect(toast).toContain("ErrorReportLink");
    expect(toast).toContain('variant === "error"');
  });

  it("auto-reports compile, cite, pdf, app error, and AI failures", () => {
    const compilePanel = readSrc("components/compile-panel.tsx");
    expect(compilePanel).toContain("reportDetectedError");

    const pdfPreview = readSrc("components/pdf-preview.tsx");
    expect(pdfPreview).toContain("reportDetectedError");

    const projectPage = readSrc("app/project/[id]/page.tsx");
    expect(projectPage).toContain("reportDetectedError");

    const errorPage = readSrc("app/error.tsx");
    expect(errorPage).toContain("reportDetectedError");

    const aiSidebar = readSrc("components/ai-sidebar.tsx");
    expect(aiSidebar).toContain("reportDetectedError");
  });

  it("maps auto payload source to Notion Error column", () => {
    const validation = readSrc("lib/user-reports-validation.ts");
    expect(validation).toContain('return source === "error" ? "Error" : "Report page"');
    expect(validation).toContain("autoDetected");
  });

  it("skips captcha for first-party auto-detected reports", () => {
    const route = readSrc("app/api/user-reports/route.ts");
    expect(route).toContain("autoDetected");
  });
});
