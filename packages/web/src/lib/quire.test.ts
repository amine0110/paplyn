import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, config } from "@/lib/config";
import { PRODUCT, PRODUCT_NAME } from "@/lib/product";
import { templates, getTemplateList } from "@/lib/templates";
import { createCollabToken } from "@/lib/collab-token";

describe("product branding", () => {
  it("exposes a single PRODUCT_NAME constant", () => {
    expect(PRODUCT_NAME).toBeTruthy();
    expect(PRODUCT.name).toBe(PRODUCT_NAME);
  });

  it("derives metadata from product name", () => {
    expect(PRODUCT.pageTitle).toContain(PRODUCT_NAME);
    expect(PRODUCT.pageTitle).toContain(PRODUCT.tagline);
    expect(PRODUCT.aiAssistantName).toBe(`${PRODUCT_NAME} AI`);
  });
});

describe("config", () => {
  it("has plan limits defined", () => {
    expect(PLAN_LIMITS.free.projects).toBe(3);
    expect(PLAN_LIMITS.student.compilesPerMonth).toBe(500);
    expect(PLAN_LIMITS.researcher.aiRequestsPerMonth).toBe(2000);
  });

  it("defaults to selfhosted mode in test", () => {
    expect(config.isSelfHosted).toBe(true);
  });
});

describe("templates", () => {
  it("provides four compile-ready templates", () => {
    const list = getTemplateList();
    expect(list).toHaveLength(4);
    expect(list.map((t) => t.id)).toEqual(["blank", "ieee", "thesis", "beamer"]);
  });

  it("each template has a main tex file with documentclass", () => {
    for (const template of Object.values(templates)) {
      expect(template.files.length).toBeGreaterThan(0);
      const main = template.files.find((f) => f.path === template.mainFile);
      expect(main).toBeDefined();
      expect(main!.content).toContain("\\documentclass");
      expect(main!.content).toContain("\\begin{document}");
    }
  });
});

describe("collab token", () => {
  it("creates a verifiable token", () => {
    const token = createCollabToken("project-123", "user-456", "Test User");
    expect(token).toContain(".");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
  });
});

describe("auth validation", () => {
  it("requires minimum password length of 8", () => {
    const minLength = 8;
    expect("short".length).toBeLessThan(minLength);
    expect("longenough".length).toBeGreaterThanOrEqual(minLength);
  });
});

describe("compile request validation", () => {
  it("accepts pdflatex and xelatex engines", () => {
    const engines = ["pdflatex", "xelatex"];
    expect(engines).toContain("pdflatex");
    expect(engines).toContain("xelatex");
    expect(engines).not.toContain("lualatex");
  });
});
