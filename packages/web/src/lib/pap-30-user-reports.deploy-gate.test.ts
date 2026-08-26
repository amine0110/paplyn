import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(ROOT, "../../..");

const DEPLOY_CONFIG_FILES = [
  "docker-compose.yml",
  "docker-compose.prod.yml",
  ".env.example",
] as const;

const hasDeployConfigFiles = DEPLOY_CONFIG_FILES.every((relativePath) =>
  existsSync(join(REPO_ROOT, relativePath)),
);

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

const USER_REPORTS_DB_ID = "b700d0bff26d432b93fb506d64c8f099";
const INTERNAL_TRACKER_ID = "b41c2d1b-4c9a-4468-a159-eefdebe9890e";

describe("PAP-30 user reports deploy gate", () => {
  it("reads Notion credentials from runtime env helpers", () => {
    const config = readSrc("lib/user-reports-config.ts");
    expect(config).toContain("process.env.NOTION_USER_REPORTS_TOKEN");
    expect(config).toContain("process.env.NOTION_TOKEN");
    expect(config).toContain("isUserReportsEnabled");
    expect(config).toContain(USER_REPORTS_DB_ID);
    expect(config).toContain(INTERNAL_TRACKER_ID);
  });

  it("writes only to the public inbox database id in the Notion client", () => {
    const notion = readSrc("lib/notion-user-reports.ts");
    expect(notion).toContain("USER_REPORTS_DATABASE_ID");
    expect(notion).not.toContain(`database_id: ${INTERNAL_TRACKER_ID}`);
    expect(notion).toContain("https://api.notion.com/v1/pages");
    expect(notion).toContain("Notion-Version");
  });

  it("does not hardcode Notion tokens in source", () => {
    const files = [
      "lib/user-reports-config.ts",
      "lib/notion-user-reports.ts",
      "app/api/user-reports/route.ts",
      "app/report/page.tsx",
      "app/report/report-form.tsx",
    ];

    for (const file of files) {
      const src = readSrc(file);
      expect(src).not.toMatch(/NOTION_USER_REPORTS_TOKEN\s*=\s*["'][^"']+["']/);
      expect(src).not.toMatch(/NOTION_TOKEN\s*=\s*["'][^"']+["']/);
      expect(src).not.toContain("secret_");
    }
  });

  it("exposes /report and links from footer, nav, settings, and editor", () => {
    expect(existsSync(join(ROOT, "app/report/page.tsx"))).toBe(true);

    const landing = readSrc("app/page.tsx");
    expect(landing).toContain('href="/report"');
    expect(landing).toContain("Report an issue");

    const sessionActions = readSrc("components/chrome-session-actions.tsx");
    expect(sessionActions).toContain('href="/report"');

    const settings = readSrc("app/settings/page.tsx");
    expect(settings).toContain('href="/report"');

    const projectPage = readSrc("app/project/[id]/page.tsx");
    expect(projectPage).toContain('href="/report"');
    expect(projectPage).toContain("ReportIssueLink");
  });

  it("hooks compile, cite, and error UI to report CTAs", () => {
    const compilePanel = readSrc("components/compile-panel.tsx");
    expect(compilePanel).toContain("ReportIssueLink");

    const pdfPreview = readSrc("components/pdf-preview.tsx");
    expect(pdfPreview).toContain("ReportIssueLink");

    const errorPage = readSrc("app/error.tsx");
    expect(errorPage).toContain("Report this issue");
    expect(errorPage).toContain("buildReportIssueHref");
  });

  it("gates submit when Notion env is missing", () => {
    const reportPage = readSrc("app/report/page.tsx");
    expect(reportPage).toContain("isUserReportsEnabled()");
    expect(reportPage).toContain("reportsEnabled=");

    const reportForm = readSrc("app/report/report-form.tsx");
    expect(reportForm).toContain("reportsEnabled");
    expect(reportForm).toContain("Reports are not configured");
  });

  it("keeps user-report CSRF crypto off the client bundle", () => {
    const clientFiles = [
      "app/report/report-form.tsx",
      "components/report-issue-link.tsx",
      "app/error.tsx",
    ];

    for (const file of clientFiles) {
      const src = readSrc(file);
      expect(src).not.toContain("node:crypto");
      expect(src).not.toMatch(/from\s+["']@\/lib\/user-reports-csrf["']/);
    }

    const reportForm = readSrc("app/report/report-form.tsx");
    expect(reportForm).toContain("user-reports-csrf-constants");
    expect(reportForm).toContain("USER_REPORT_CSRF_HEADER");
  });

  it("documents reporting without secrets", () => {
    const reportDoc = readFileSync(join(ROOT, "../content/docs/report.md"), "utf8");
    expect(reportDoc).toContain("/report");
    expect(reportDoc).not.toContain("NOTION");
    expect(reportDoc).not.toContain("TURNSTILE");
  });

  it.skipIf(!hasDeployConfigFiles)(
    "passes report env through docker compose at runtime",
    () => {
      const compose = readRepoFile("docker-compose.yml");
      const composeProd = readRepoFile("docker-compose.prod.yml");
      const envExample = readRepoFile(".env.example");

      for (const file of [compose, composeProd, envExample]) {
        expect(file).toContain("NOTION_USER_REPORTS_TOKEN");
        expect(file).toContain("NOTION_USER_REPORTS_DATABASE_ID");
        expect(file).toContain("TURNSTILE_SECRET_KEY");
        expect(file).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
      }

      const webService = compose.match(/  web:\n[\s\S]*?(?=\n  \w|$)/)?.[0] ?? "";
      const webBuildArgs = webService.match(/args:\n[\s\S]*?(?=\n    environment:)/)?.[0] ?? "";
      expect(webBuildArgs).not.toContain("NOTION_USER_REPORTS_TOKEN");
      expect(webBuildArgs).not.toContain("TURNSTILE_SECRET_KEY");
    },
  );
});
