import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchZoteroItemBibtex,
  formatZoteroSearchForModel,
  mapZoteroApiItem,
  parseZoteroSearchResponse,
  searchZoteroLibrary,
  ZoteroError,
} from "./zotero";

const credentials = { userId: "12345", apiKey: "test-key" };

const SAMPLE_ITEM = {
  key: "ITEMKEY1",
  data: {
    key: "ITEMKEY1",
    itemType: "journalArticle",
    title: "Sample Zotero Paper",
    date: "2021-05-12",
    creators: [{ creatorType: "author", firstName: "Ada", lastName: "Lovelace" }],
  },
};

describe("zotero", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps API items and skips attachments", () => {
    const mapped = mapZoteroApiItem(SAMPLE_ITEM);
    expect(mapped).toEqual({
      itemKey: "ITEMKEY1",
      title: "Sample Zotero Paper",
      year: 2021,
      authors: ["Ada Lovelace"],
      itemType: "journalArticle",
    });

    expect(
      mapZoteroApiItem({
        key: "ATTACH",
        data: { itemType: "attachment", title: "PDF" },
      })
    ).toBeNull();
  });

  it("parses search responses", () => {
    const result = parseZoteroSearchResponse("attention", [SAMPLE_ITEM]);
    expect(result.query).toBe("attention");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("Sample Zotero Paper");
  });

  it("formats model summaries for empty and non-empty results", () => {
    expect(formatZoteroSearchForModel({ query: "none", items: [] })).toContain("No Zotero");
    expect(
      formatZoteroSearchForModel({
        query: "sample",
        items: [
          {
            itemKey: "ITEMKEY1",
            title: "Sample Zotero Paper",
            year: 2021,
            authors: ["Ada Lovelace"],
            itemType: "journalArticle",
          },
        ],
      })
    ).toContain("ITEMKEY1");
  });

  it("searches the library with mocked fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [SAMPLE_ITEM],
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchZoteroLibrary(credentials, "sample paper");
    expect(result.items).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("api.zotero.org/users/12345/items");
    expect(calledUrl).toContain("qmode=titleCreatorYear");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        "Zotero-API-Key": "test-key",
      }),
    });
  });

  it("maps 403 to invalid key error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      })
    );

    await expect(searchZoteroLibrary(credentials, "paper")).rejects.toMatchObject({
      message: expect.stringContaining("Invalid Zotero API key"),
      status: 403,
    });
  });

  it("fetches BibTeX for an item with mocked fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "@article{lovelace2021sample, title = {Sample Zotero Paper}}",
    });
    vi.stubGlobal("fetch", fetchMock);

    const bibtex = await fetchZoteroItemBibtex(credentials, "ITEMKEY1");
    expect(bibtex).toContain("lovelace2021sample");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("format=bibtex");
  });

  it("requires a search query", async () => {
    await expect(searchZoteroLibrary(credentials, "   ")).rejects.toBeInstanceOf(ZoteroError);
  });
});
