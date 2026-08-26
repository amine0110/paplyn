import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotionUserReport } from "@/lib/notion-user-reports";
import {
  PAP_INTERNAL_TRACKER_COLLECTION,
  USER_REPORTS_DATABASE_ID,
} from "@/lib/user-reports-config";

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

describe("createNotionUserReport", () => {
  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it("posts to the public inbox database with plain-text properties", async () => {
    process.env.NOTION_USER_REPORTS_TOKEN = "secret-token";
    process.env.NOTION_USER_REPORTS_DATABASE_ID = USER_REPORTS_DATABASE_ID;

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "page-123" }),
    }));

    const result = await createNotionUserReport(
      {
        title: "Compile failed",
        whatHappened: "No PDF output",
        steps: "Click compile",
        email: "user@example.com",
        page: "/project/abc",
        source: "Error",
        signedIn: true,
        receivedDate: "2026-08-26",
      },
      fetchMock as typeof fetch,
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.notion.com/v1/pages");
    expect(options.method).toBe("POST");

    const payload = JSON.parse(String(options.body));
    expect(payload.parent.database_id).toBe(USER_REPORTS_DATABASE_ID);
    expect(payload.parent.database_id).not.toBe(PAP_INTERNAL_TRACKER_COLLECTION);
    expect(payload.properties.Name.title[0].text.content).toBe("Compile failed");
    expect(payload.properties["What happened"].rich_text[0].text.content).toBe("No PDF output");
    expect(payload.properties.Steps.rich_text[0].text.content).toBe("Click compile");
    expect(payload.properties.Email.email).toBe("user@example.com");
    expect(payload.properties.Page.rich_text[0].text.content).toBe("/project/abc");
    expect(payload.properties.Status.select.name).toBe("New");
    expect(payload.properties.Source.select.name).toBe("Error");
    expect(payload.properties["Signed in"].checkbox).toBe(true);
    expect(payload.properties.Received.date.start).toBe("2026-08-26");
    expect(payload.children.every((block: { type: string }) => block.type === "paragraph")).toBe(true);
  });

  it("writes empty Steps rich_text when steps are omitted", async () => {
    process.env.NOTION_USER_REPORTS_TOKEN = "secret-token";
    process.env.NOTION_USER_REPORTS_DATABASE_ID = USER_REPORTS_DATABASE_ID;

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "page-456" }),
    }));

    await createNotionUserReport(
      {
        title: "Broken UI",
        whatHappened: "Button did nothing",
        steps: "",
        email: null,
        page: "/report",
        source: "Report page",
        signedIn: false,
        receivedDate: "2026-08-26",
      },
      fetchMock as typeof fetch,
    );

    const payload = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(payload.properties["What happened"].rich_text[0].text.content).toBe("Button did nothing");
    expect(payload.properties.Steps.rich_text[0].text.content).toBe("");
  });

  it("never uses the internal PAP tracker database id", async () => {
    process.env.NOTION_USER_REPORTS_TOKEN = "secret-token";
    process.env.NOTION_USER_REPORTS_DATABASE_ID = PAP_INTERNAL_TRACKER_COLLECTION;

    const fetchMock = vi.fn();
    const result = await createNotionUserReport(
      {
        title: "Test",
        whatHappened: "Broken",
        steps: "",
        email: null,
        page: "",
        source: "Report page",
        signedIn: false,
        receivedDate: "2026-08-26",
      },
      fetchMock as typeof fetch,
    );

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not configured when token is missing", async () => {
    delete process.env.NOTION_USER_REPORTS_TOKEN;
    delete process.env.NOTION_TOKEN;

    const result = await createNotionUserReport({
      title: "Test",
      whatHappened: "Broken",
      steps: "",
      email: null,
      page: "",
      source: "Report page",
      signedIn: false,
      receivedDate: "2026-08-26",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
  });
});
