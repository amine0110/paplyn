import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { gunzipSync } from "zlib";
import { getDocument } from "pdfjs-dist/build/pdf.mjs";
import { parseSynctex, findSynctexSource, explainSynctexLookup } from "./synctex";
import {
  analyzeSynctexPdfAlignment,
  buildPdfToSynctexPageMap,
  findSynctexPageForLine,
  listSynctexPageRecords,
  preambleLinesOnSynctexPage,
} from "./synctex-page-alignment";
import { viewportClickToSynctexPoint } from "./pdf-synctex-coords";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

/** Introduction body line in ieee-prod-two-page (pdflatex with `beleive` token). */
const INTRO_BODY_LINE = 40;
const PREAMBLE_LINES = [5, 6, 7, 8, 9, 10, 11];

function loadProdSynctexText(): string {
  return gunzipSync(readFileSync(join(FIXTURES, "ieee-prod-two-page.synctex.gz"))).toString(
    "latin1"
  );
}

function loadProdIndex() {
  return parseSynctex(loadProdSynctexText())!;
}

describe("synctex page records (production-layout compile)", () => {
  it("lists Input and {n/}n page open records from raw synctex", () => {
    const text = loadProdSynctexText();
    expect(text).toMatch(/Input:1:.*main\.tex/);
    const records = listSynctexPageRecords(text);
    expect(records.open).toEqual([1, 2]);
    expect(records.close).toEqual([1, 2]);
  });

  it("places preamble lines 5–11 only on synctex page 1; intro body on page 2", () => {
    const index = loadProdIndex();
    expect(preambleLinesOnSynctexPage(index, 1)).toEqual(PREAMBLE_LINES);
    expect(preambleLinesOnSynctexPage(index, 2)).toEqual([]);

    const introPage = findSynctexPageForLine(index, INTRO_BODY_LINE);
    expect(introPage).toBe(2);
    expect(findSynctexPageForLine(index, 6)).toBe(1);
    expect(findSynctexPageForLine(index, 9)).toBe(1);
  });
});

describe("PDF ↔ synctex page alignment (matched compile)", () => {
  it("maps PDF page 2 to synctex page 2 when both have 2 pages", async () => {
    const index = loadProdIndex();
    const pdfData = new Uint8Array(readFileSync(join(FIXTURES, "ieee-prod-two-page.pdf")));
    const pdf = await getDocument({ data: pdfData }).promise;

    expect(pdf.numPages).toBe(2);

    const report = analyzeSynctexPdfAlignment(pdf.numPages, index, {
      introductionLine: INTRO_BODY_LINE,
    });

    expect(report.countsMatch).toBe(true);
    expect(report.synctexPageNumbers).toEqual([1, 2]);
    expect(report.introductionSynctexPage).toBe(2);
    expect(report.pdfToSynctexPage[1]).toBe(1);
    expect(report.pdfToSynctexPage[2]).toBe(2);
    expect(report.mismatchReason).toBeNull();

    expect(report.pageSummaries[0].uniqueLines.some((l) => l <= 11)).toBe(true);
    expect(preambleLinesOnSynctexPage(index, 1).length).toBeGreaterThan(0);
    expect(report.pageSummaries[1].hasBodyContent).toBe(true);
  });

  it("maps page-2 intro click to Introduction line when PDF page count is passed", async () => {
    const index = loadProdIndex();
    const pdf = await getDocument({
      data: new Uint8Array(readFileSync(join(FIXTURES, "ieee-prod-two-page.pdf"))),
    }).promise;
    const pdfPage = await pdf.getPage(2);
    const viewport = pdfPage.getViewport({ scale: 0.95 });
    const canvasH = Math.floor(viewport.height);
    const [synctexX, synctexY] = viewportClickToSynctexPoint(120, 280, viewport, canvasH);

    const explained = explainSynctexLookup(index, 2, synctexX, synctexY, ["main.tex"], undefined, {
      pdfPage: 2,
      pdfPageCount: pdf.numPages,
    });

    expect(explained.pdfPage).toBe(2);
    expect(explained.lookupPage).toBe(2);
    expect(explained.pageMappingNote).toBeNull();
    expect(explained.synctexY).toBeGreaterThan(200);
    expect(explained.hit?.line).toBe(INTRO_BODY_LINE);
    expect(PREAMBLE_LINES).not.toContain(explained.hit?.line);
  });
});

describe("stale synctex counterexample (1-page synctex + 2-page PDF)", () => {
  it("documents page-count mismatch and offset mapping", async () => {
    const index1 = parseSynctex(
      gunzipSync(readFileSync(join(FIXTURES, "ieee-one-page.synctex.gz"))).toString("latin1")
    )!;
    const pdf = await getDocument({
      data: new Uint8Array(readFileSync(join(FIXTURES, "ieee-prod-two-page.pdf"))),
    }).promise;

    expect(pdf.numPages).toBe(2);
    expect(Object.keys(index1.pageBlocks)).toEqual(["1"]);

    const report = analyzeSynctexPdfAlignment(pdf.numPages, index1, {
      introductionLine: 39,
    });
    expect(report.countsMatch).toBe(false);
    expect(report.mismatchReason).toContain("PDF has 2 page(s) but synctex has 1");

    const map = buildPdfToSynctexPageMap(pdf.numPages, index1);
    expect(map[2]).toBe(1);
    expect(map[1]).toBe(1);

    const pdfPage2 = await pdf.getPage(2);
    const viewport = pdfPage2.getViewport({ scale: 0.95 });
    const canvasH = Math.floor(viewport.height);
    const [x, y] = viewportClickToSynctexPoint(120, 280, viewport, canvasH);

    expect(findSynctexSource(index1, 2, x, y, ["main.tex"])).toBeNull();

    const mapped = explainSynctexLookup(index1, 2, x, y, ["main.tex"], undefined, {
      pdfPage: 2,
      pdfPageCount: pdf.numPages,
    });
    expect(mapped.lookupPage).toBe(1);
    expect(mapped.hit?.line).toBe(39);
    expect(PREAMBLE_LINES).not.toContain(mapped.hit?.line);
  });

  it("cannot produce usepackage line 6 via page-2 lookup even with collapsed Y", async () => {
    const index = loadProdIndex();
    const pdf = await getDocument({
      data: new Uint8Array(readFileSync(join(FIXTURES, "ieee-prod-two-page.pdf"))),
    }).promise;
    const pdfPage = await pdf.getPage(2);
    const viewport = pdfPage.getViewport({ scale: 0.95 });
    const canvasH = Math.floor(viewport.height);
    const [x, y] = viewportClickToSynctexPoint(120, 55, viewport, canvasH);

    const page2Hit = findSynctexSource(index, 2, x, y, ["main.tex"]);
    expect(page2Hit?.line).not.toBe(6);
    expect(PREAMBLE_LINES).not.toContain(page2Hit?.line);

    const page1Hit = findSynctexSource(index, 1, x, y, ["main.tex"]);
    expect(page1Hit?.line).toBe(10);
    expect(page1Hit?.line).not.toBe(6);
  });
});

describe("production preamble signature (why toolbar page 2 can still hit preamble)", () => {
  it("logs the coordinate trace: page-1 lookup + collapsed Y → preamble band, not page-2", async () => {
    const index = loadProdIndex();
    const pdf = await getDocument({
      data: new Uint8Array(readFileSync(join(FIXTURES, "ieee-prod-two-page.pdf"))),
    }).promise;
    const pdfPage = await pdf.getPage(2);
    const viewport = pdfPage.getViewport({ scale: 0.95 });
    const canvasH = Math.floor(viewport.height);
    const [collapsedX, collapsedY] = viewportClickToSynctexPoint(120, 55, viewport, canvasH);

    const wrongPage = explainSynctexLookup(index, 1, collapsedX, collapsedY, ["main.tex"]);
    const toolbarPage2 = explainSynctexLookup(index, 2, collapsedX, collapsedY, ["main.tex"], undefined, {
      pdfPage: 2,
      pdfPageCount: pdf.numPages,
    });

    expect(collapsedY).toBeLessThan(80);
    expect(wrongPage.lookupPage).toBe(1);
    expect(wrongPage.hit?.line).toBe(10);
    expect(wrongPage.chosenBlock?.top).toBeCloseTo(52, 0);

    expect(toolbarPage2.lookupPage).toBe(2);
    expect(PREAMBLE_LINES).not.toContain(toolbarPage2.hit?.line);

    expect(findSynctexPageForLine(index, 6)).toBe(1);
    expect(findSynctexPageForLine(index, 9)).toBe(1);
  });
});
