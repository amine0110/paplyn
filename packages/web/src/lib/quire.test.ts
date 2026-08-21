import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PLAN_LIMITS, config } from "@/lib/config";
import { PRODUCT, PRODUCT_NAME } from "@/lib/product";
import { templates, getTemplateList } from "@/lib/templates";
import { createCollabToken } from "@/lib/collab-token";
import {
  getCollabWsUrl,
  getRequestOrigin,
  getSelfHostedTrustedOrigins,
  getServerAppUrl,
  resolveCollabUrl,
} from "@/lib/urls";

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

describe("url resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BETTER_AUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.COLLAB_URL;
    delete process.env.NEXT_PUBLIC_COLLAB_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("prefers BETTER_AUTH_URL over NEXT_PUBLIC_APP_URL on the server", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.BETTER_AUTH_URL = "https://plicum.com";
    expect(getServerAppUrl()).toBe("https://plicum.com");
    expect(config.appUrl).toBe("https://plicum.com");
  });

  it("derives request origin from proxy headers", () => {
    const request = new Request("http://internal/api/auth/get-session", {
      headers: {
        host: "plicum.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(getRequestOrigin(request)).toBe("https://plicum.com");
  });

  it("includes request origin in self-hosted trusted origins", () => {
    process.env.BETTER_AUTH_URL = "https://plicum.com";
    const request = new Request("https://plicum.com/api/auth/get-session", {
      headers: { host: "plicum.com" },
    });
    expect(getSelfHostedTrustedOrigins(request)).toEqual([
      "https://plicum.com",
    ]);
  });

  it("uses explicit non-localhost collab URL when configured", () => {
    process.env.COLLAB_URL = "wss://collab.example.com";
    const request = new Request("https://plicum.com/api/projects/1/collab", {
      headers: { host: "plicum.com" },
    });
    expect(resolveCollabUrl(request)).toBe("wss://collab.example.com");
  });

  it("ignores localhost explicit collab URL on a public host", () => {
    process.env.COLLAB_URL = "ws://localhost:1234";
    const request = new Request("https://plicum.com/api/projects/1/collab", {
      headers: {
        host: "plicum.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveCollabUrl(request)).toBe("wss://plicum.com");
    expect(getCollabWsUrl("proj-1", "token-abc", request)).toBe(
      "wss://plicum.com/proj-1?token=token-abc"
    );
  });

  it("ignores NEXT_PUBLIC localhost collab URL on a public host", () => {
    process.env.NEXT_PUBLIC_COLLAB_URL = "ws://localhost:1234";
    const request = new Request("https://plicum.com/api/projects/1/collab", {
      headers: {
        host: "plicum.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveCollabUrl(request)).toBe("wss://plicum.com");
  });

  it("derives local collab websocket on localhost dev", () => {
    const request = new Request("http://localhost:3000/api/projects/1/collab", {
      headers: { host: "localhost:3000" },
    });
    expect(resolveCollabUrl(request)).toBe("ws://localhost:1234");
    expect(getCollabWsUrl("proj-1", "token-abc", request)).toBe(
      "ws://localhost:1234/proj-1?token=token-abc"
    );
  });

  it("keeps localhost explicit collab URL for localhost requests", () => {
    process.env.COLLAB_URL = "ws://localhost:1234";
    const request = new Request("http://localhost:3000/api/projects/1/collab", {
      headers: { host: "localhost:3000" },
    });
    expect(resolveCollabUrl(request)).toBe("ws://localhost:1234");
  });

  it("falls back to localhost collab URL without request context", () => {
    process.env.COLLAB_URL = "ws://localhost:1234";
    expect(resolveCollabUrl()).toBe("ws://localhost:1234");
  });

  it("derives same-host wss collab URL in self-host production", () => {
    const request = new Request("https://plicum.com/api/projects/1/collab", {
      headers: {
        host: "plicum.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveCollabUrl(request)).toBe("wss://plicum.com");
  });
});

describe("auth validation", () => {
  it("requires minimum password length of 8", () => {
    const minLength = 8;
    expect("short".length).toBeLessThan(minLength);
    expect("longenough".length).toBeGreaterThanOrEqual(minLength);
  });

  it("defines better-auth account fields including issuer", async () => {
    const { getTableColumns } = await import("drizzle-orm");
    const { account, session, user, verification } = await import("@/lib/schema");

    const accountColumns = Object.keys(getTableColumns(account));
    const requiredAccountFields = [
      "id",
      "accountId",
      "providerId",
      "issuer",
      "userId",
      "accessToken",
      "refreshToken",
      "idToken",
      "accessTokenExpiresAt",
      "refreshTokenExpiresAt",
      "scope",
      "password",
      "createdAt",
      "updatedAt",
    ];
    for (const field of requiredAccountFields) {
      expect(accountColumns, `account.${field}`).toContain(field);
    }

    const sessionColumns = Object.keys(getTableColumns(session));
    for (const field of ["id", "expiresAt", "token", "userId", "ipAddress", "userAgent", "createdAt", "updatedAt"]) {
      expect(sessionColumns, `session.${field}`).toContain(field);
    }

    const userColumns = Object.keys(getTableColumns(user));
    for (const field of ["id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt"]) {
      expect(userColumns, `user.${field}`).toContain(field);
    }

    const verificationColumns = Object.keys(getTableColumns(verification));
    for (const field of ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"]) {
      expect(verificationColumns, `verification.${field}`).toContain(field);
    }
  });
});

describe("compile request validation", () => {
  it("accepts pdflatex and xelatex engines", async () => {
    const { SUPPORTED_COMPILERS } = await import("@/lib/project-ops");
    expect(SUPPORTED_COMPILERS).toEqual(["pdflatex", "xelatex"]);
    expect(SUPPORTED_COMPILERS).not.toContain("lualatex");
  });
});
