import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { gunzipSync } from "zlib";
import { getDocument } from "pdfjs-dist/build/pdf.mjs";
import {
  parseSynctex,
  findSynctexSource,
  explainSynctexLookup,
  synctexLookupFromBase64,
} from "./synctex";
import {
  findSynctexPageForLine,
  listSynctexPageRecords,
  linesWithSynctexBlocks,
} from "./synctex-page-alignment";
import { viewportClickToSynctexPoint } from "./pdf-synctex-coords";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

/** Production layout: `beleive` after \\title; usepackage lines have no synctex blocks. */
const USEPACKAGE_LINES = [5, 6, 7, 8];
const INTRO_SECTION_LINE = 39;
const BODY_LINE_THRESHOLD = 30;

function loadLiveLayoutSynctexText(): string {
  return gunzipSync(readFileSync(join(FIXTURES, "ieee-prod-live-layout.synctex.gz"))).toString(
    "latin1"
  );
}

function loadLiveLayoutIndex() {
  return parseSynctex(loadLiveLayoutSynctexText())!;
}

describe("live production-layout synctex (beleive after title)", () => {
  it("has matching 2-page PDF and synctex page records", async () => {
    const text = loadLiveLayoutSynctexText();
    const records = listSynctexPageRecords(text);
    expect(records.open).toEqual([1, 2]);

    const pdf = await getDocument({
      data: new Uint8Array(readFileSync(join(FIXTURES, "ieee-prod-live-layout.pdf"))),
    }).promise;
    expect(pdf.numPages).toBe(2);
    expect(records.open.length).toBe(pdf.numPages);
  });

  it("has ZERO synctex blocks for usepackage lines 5–8 (like production dump)", () => {
    const index = loadLiveLayoutIndex();
    const blocked = linesWithSynctexBlocks(index, USEPACKAGE_LINES);
    expect(blocked).toEqual([]);
    for (const line of USEPACKAGE_LINES) {
      expect(findSynctexPageForLine(index, line)).toBeNull();
    }
  });

  it("maps intro section to synctex page 2; beleive token to page 1", () => {
    const index = loadLiveLayoutIndex();
    expect(findSynctexPageForLine(index, 14)).toBe(1);
    expect(findSynctexPageForLine(index, INTRO_SECTION_LINE)).toBe(2);
  });
});

describe("page-2 clicks cannot return usepackage line 6 (production signature)", () => {
  async function page2IntroClick() {
    const index = loadLiveLayoutIndex();
    const pdf = await getDocument({
      data: new Uint8Array(readFileSync(join(FIXTURES, "ieee-prod-live-layout.pdf"))),
    }).promise;
    const pdfPage = await pdf.getPage(2);
    const viewport = pdfPage.getViewport({ scale: 0.95 });
    const canvasH = Math.floor(viewport.height);
    const [x, y] = viewportClickToSynctexPoint(120, 280, viewport, canvasH);
    return { index, pdf, x, y };
  }

  it("findSynctexSource on page 2 never returns line 6 or other usepackage lines", async () => {
    const { index, x, y } = await page2IntroClick();
    const hit = findSynctexSource(index, 2, x, y, ["main.tex"]);
    expect(hit?.line).not.toBe(6);
    expect(USEPACKAGE_LINES).not.toContain(hit?.line);
    expect(hit?.line).toBeGreaterThanOrEqual(BODY_LINE_THRESHOLD);
    expect(findSynctexPageForLine(index, hit!.line)).toBe(2);
  });

  it("synctexLookupFromBase64 on page 2 never returns line 6", async () => {
    const { pdf, x, y } = await page2IntroClick();
    const base64 = readFileSync(join(FIXTURES, "ieee-prod-live-layout.synctex.gz")).toString(
      "base64"
    );
    const hit = await synctexLookupFromBase64(base64, 2, x, y, ["main.tex"], {
      pdfPageCount: pdf.numPages,
    });
    expect(hit?.line).not.toBe(6);
    expect(USEPACKAGE_LINES).not.toContain(hit?.line);
    expect(hit?.line).toBeGreaterThanOrEqual(BODY_LINE_THRESHOLD);
  });

  it("wrong page-1 lookup at collapsed Y cannot return line 6 when those lines have no blocks", async () => {
    const { index, pdf, x, y } = await page2IntroClick();
    const viewport = (await pdf.getPage(2)).getViewport({ scale: 0.95 });
    const canvasH = Math.floor(viewport.height);
    const [collapsedX, collapsedY] = viewportClickToSynctexPoint(120, 55, viewport, canvasH);

    const page1 = explainSynctexLookup(index, 1, collapsedX, collapsedY, ["main.tex"]);
    expect(page1.hit?.line).not.toBe(6);
    expect(USEPACKAGE_LINES).not.toContain(page1.hit?.line);

    const page2 = explainSynctexLookup(index, 2, collapsedX, collapsedY, ["main.tex"], undefined, {
      pdfPage: 2,
      pdfPageCount: pdf.numPages,
    });
    expect(page2.hit?.line).not.toBe(6);
    expect(USEPACKAGE_LINES).not.toContain(page2.hit?.line);
  });
});

describe("stale synctex paired with live-layout PDF (client bug counterexample)", () => {
  it("old preamble-heavy synctex + new PDF would return preamble on page-1 search only", async () => {
    const staleIndex = parseSynctex(
      gunzipSync(readFileSync(join(FIXTURES, "ieee-prod-two-page.synctex.gz"))).toString("latin1")
    )!;
    const pdf = await getDocument({
      data: new Uint8Array(readFileSync(join(FIXTURES, "ieee-prod-live-layout.pdf"))),
    }).promise;
    const pdfPage = await pdf.getPage(2);
    const viewport = pdfPage.getViewport({ scale: 0.95 });
    const [x, y] = viewportClickToSynctexPoint(120, 55, viewport, Math.floor(viewport.height));

    const wrongPageHit = findSynctexSource(staleIndex, 1, x, y, ["main.tex"]);
    expect(wrongPageHit?.line).not.toBe(6);
    expect(wrongPageHit?.line).toBe(10);

    const liveIndex = loadLiveLayoutIndex();
    const correctHit = findSynctexSource(liveIndex, 2, x, y, ["main.tex"]);
    expect(USEPACKAGE_LINES).not.toContain(correctHit?.line);
  });
});
