import {
  getNotionUserReportsDatabaseId,
  getNotionUserReportsToken,
  PAP_INTERNAL_TRACKER_COLLECTION,
  USER_REPORTS_DATABASE_ID,
} from "@/lib/user-reports-config";
import type { SanitizedUserReport } from "@/lib/user-reports-validation";
import { buildReportPageBody } from "@/lib/user-reports-validation";

const NOTION_API_VERSION = "2022-06-28";
const NOTION_PAGES_URL = "https://api.notion.com/v1/pages";
const NOTION_RICH_TEXT_CHUNK = 2000;

type NotionRichText = {
  type: "text";
  text: { content: string };
};

function chunkRichText(text: string): NotionRichText[] {
  if (!text) return [{ type: "text", text: { content: "" } }];
  const chunks: NotionRichText[] = [];
  for (let i = 0; i < text.length; i += NOTION_RICH_TEXT_CHUNK) {
    chunks.push({ type: "text", text: { content: text.slice(i, i + NOTION_RICH_TEXT_CHUNK) } });
  }
  return chunks;
}

function paragraphBlock(text: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: chunkRichText(text),
    },
  };
}

export type CreateNotionUserReportResult =
  | { ok: true; pageId: string }
  | { ok: false; error: string; status?: number };

export async function createNotionUserReport(
  report: SanitizedUserReport,
  fetchImpl: typeof fetch = fetch,
): Promise<CreateNotionUserReportResult> {
  const token = getNotionUserReportsToken();
  if (!token) {
    return { ok: false, error: "User reports are not configured", status: 503 };
  }

  const databaseId = getNotionUserReportsDatabaseId().replace(/-/g, "");
  const normalizedInternal = PAP_INTERNAL_TRACKER_COLLECTION.replace(/-/g, "");
  if (databaseId === normalizedInternal) {
    return { ok: false, error: "Invalid reports database configuration", status: 500 };
  }

  if (databaseId !== USER_REPORTS_DATABASE_ID) {
    return { ok: false, error: "Invalid reports database configuration", status: 500 };
  }

  const bodyText = buildReportPageBody(report);
  const bodyBlocks = bodyText.split("\n").map((line) => paragraphBlock(line));

  const payload = {
    parent: { database_id: USER_REPORTS_DATABASE_ID },
    properties: {
      Name: {
        title: chunkRichText(report.title),
      },
      Status: {
        select: { name: "New" },
      },
      ...(report.email
        ? { Email: { email: report.email } }
        : {}),
      Source: {
        select: { name: report.source },
      },
      Page: {
        rich_text: chunkRichText(report.page),
      },
      "Signed in": {
        checkbox: report.signedIn,
      },
      Received: {
        date: { start: report.receivedDate },
      },
    },
    children: bodyBlocks,
  };

  const response = await fetchImpl(NOTION_PAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return {
      ok: false,
      error: "Failed to submit report",
      status: response.status,
    };
  }

  const data = (await response.json()) as { id?: string };
  return { ok: true, pageId: data.id ?? "unknown" };
}
