import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { gunzipSync } from "zlib";
import { getDocument } from "pdfjs-dist/build/pdf.mjs";
import {
  clientClickToSynctexPoint,
  domClickOffset,
  getPdfPageHeight,
  scrollAwareCanvasClickOffset,
  scrollAwareClickToSynctexPoint,
  type PdfClickDomContext,
  type PdfViewportLike,
  viewportClickToSynctexPoint,
} from "./pdf-synctex-coords";
import { explainSynctexLookup, findSynctexSource, parseSynctex } from "./synctex";

const FIXTURES = join(import.meta.dirname, "__fixtures__");

/** Letter-size view box used by pdf.js for many LaTeX PDFs. */
const LETTER_VIEW = [0, 0, 612, 792] as const;
const PAGE_HEIGHT = LETTER_VIEW[3] - LETTER_VIEW[1];
const SYNCTEX_OFFSET_SP = 4736287; // 72pt

/** Minimal viewport matching pdf.js rotation=0 transform for tests. */
function letterViewport(scale: number): PdfViewportLike {
  const width = (LETTER_VIEW[2] - LETTER_VIEW[0]) * scale;
  const height = (LETTER_VIEW[3] - LETTER_VIEW[1]) * scale;
  return {
    width,
    height,
    convertToPdfPoint(x: number, y: number) {
      return [LETTER_VIEW[0] + x / scale, LETTER_VIEW[3] - y / scale];
    },
  };
}

function canvasHeight(viewport: PdfViewportLike): number {
  return Math.floor(viewport.height);
}

function sp(points: number): number {
  return Math.round(points * 65781.76);
}

/**
 * IEEE-style 1-page fixture. Block coordinates are page-local (synctex spec);
 * global pdf.js clicks subtract the 72pt offset inside findSynctexSource.
 */
function ieeeSynctexFixture(): string {
  const left = 0;
  const blockWidth = sp(200);
  const blockHeight = sp(24);

  function block(line: number, bottomPt: number): string[] {
    const b = sp(bottomPt);
    return [
      `[1,${line}:${left},${b}:${blockWidth},${blockHeight},0`,
      `x1,${line}:${left},${b}:${blockWidth}`,
      "]",
    ];
  }

  return [
    "SyncTeX version:1",
    "Input:1:main.tex",
    "Output:pdf",
    `X Offset:${SYNCTEX_OFFSET_SP}`,
    `Y Offset:${SYNCTEX_OFFSET_SP}`,
    "{1",
    ...block(12, 108),
    ...block(29, 178),
    ...block(37, 248),
    ...block(41, 348),
    ...block(53, 370),
    ...block(58, 628),
    "}1",
  ].join("\n");
}

describe("getPdfPageHeight", () => {
  it("returns media box height from the page view array", () => {
    expect(getPdfPageHeight({ view: [0, 0, 612, 792] })).toBe(792);
  });
});

describe("domClickOffset", () => {
  it("subtracts the page element origin from client coordinates", () => {
    expect(domClickOffset(150, 260, { left: 48, top: 12 })).toEqual({ x: 102, y: 248 });
  });
});

describe("viewportClickToSynctexPoint", () => {
  it("returns SyncTeX Y-down coordinates (distance from page top)", () => {
    const viewport = letterViewport(1);
    const h = canvasHeight(viewport);

    const topClick = viewportClickToSynctexPoint(100, 0, viewport, h);
    const bottomClick = viewportClickToSynctexPoint(100, h, viewport, h);

    expect(topClick[1]).toBeLessThan(bottomClick[1]);
    expect(topClick[1]).toBeCloseTo(0, 0);
    expect(bottomClick[1]).toBeCloseTo(PAGE_HEIGHT, 0);
  });

  it("matches LaTeX-Workshop getPagePoint (convertToPdfPoint with canvasHeight - clickY)", () => {
    const viewport = letterViewport(0.95);
    const clickX = 120;
    const clickY = 40;
    const h = canvasHeight(viewport);
    const [synctexX, synctexY] = viewportClickToSynctexPoint(clickX, clickY, viewport, h);
    const [lwX, lwY] = viewport.convertToPdfPoint(clickX, h - clickY);
    expect(synctexX).toBeCloseTo(lwX, 5);
    expect(synctexY).toBeCloseTo(lwY, 5);
    expect(synctexY).toBeCloseTo(clickY / 0.95, 0);
  });

  it("uses floor(canvasHeight) for the Y flip at fractional scales", () => {
    const viewport = letterViewport(0.95);
    const clickX = 120;
    const clickY = 40;
    const h = canvasHeight(viewport);
    const [synctexX, synctexY] = viewportClickToSynctexPoint(clickX, clickY, viewport, h);
    const [lwX, lwY] = viewport.convertToPdfPoint(clickX, h - clickY);
    expect(synctexX).toBeCloseTo(lwX, 5);
    expect(synctexY).toBeCloseTo(lwY, 5);
  });

  it("scales with viewport zoom", () => {
    const viewport = letterViewport(1.5);
    const h = canvasHeight(viewport);
    const [x, y] = viewportClickToSynctexPoint(viewport.width / 2, h / 2, viewport, h);
    expect(x).toBeCloseTo(LETTER_VIEW[2] / 2, 0);
    expect(y).toBeCloseTo(PAGE_HEIGHT / 2, 0);
  });
});

describe("scrollAwareCanvasClickOffset", () => {
  it("matches LaTeX-Workshop pageX/pageY + scrollTop formula", () => {
    const dom: PdfClickDomContext = {
      pageX: 420,
      pageY: 680,
      pageOffsetLeft: 48,
      pageOffsetTop: 120,
      scrollLeft: 0,
      scrollTop: 240,
      canvasOffsetLeft: 12,
      canvasOffsetTop: 8,
      canvasOffsetHeight: 752,
    };
    const { x, y } = scrollAwareCanvasClickOffset({ pageX: dom.pageX, pageY: dom.pageY }, dom);
    expect(x).toBe(420 - 48 + 0 - 12);
    expect(y).toBe(680 - 120 + 240 - 8);
  });

  it("differs from clientX/rect when the proof pane is scrolled", () => {
    const viewport = letterViewport(0.95);
    const dom: PdfClickDomContext = {
      pageX: 300,
      pageY: 500,
      pageOffsetLeft: 40,
      pageOffsetTop: 100,
      scrollLeft: 0,
      scrollTop: 180,
      canvasOffsetLeft: 0,
      canvasOffsetTop: 0,
      canvasOffsetHeight: canvasHeight(viewport),
    };
    const scroll = scrollAwareClickToSynctexPoint({ pageX: dom.pageX, pageY: dom.pageY }, dom, viewport);
    const client = clientClickToSynctexPoint(
      300,
      320,
      { left: 40, top: 320, height: canvasHeight(viewport) },
      viewport
    );
    expect(scroll[1]).not.toBeCloseTo(client[1], 0);
  });
});

describe("clientClickToSynctexPoint", () => {
  it("uses the canvas bounding rect rather than a padded wrapper", () => {
    const viewport = letterViewport(1);
    const canvasRect = { left: 80, top: 40, height: canvasHeight(viewport) };

    const fromCanvas = clientClickToSynctexPoint(
      canvasRect.left + 72,
      canvasRect.top + 50,
      canvasRect,
      viewport
    );
    const fromWrapper = clientClickToSynctexPoint(
      canvasRect.left + 72,
      canvasRect.top + 50,
      { left: 0, top: 40, height: canvasHeight(viewport) },
      viewport
    );

    expect(fromCanvas[0]).toBeCloseTo(72, 5);
    expect(fromWrapper[0]).not.toBeCloseTo(72, 5);
  });
});

describe("synctex lookup with converted click coordinates", () => {
  it("parses the IEEE fixture with element blocks", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    expect(index.pageBlocks[1]?.length).toBeGreaterThan(0);
    expect(index.offset.x).toBeCloseTo(72, 0);
    const intro = index.pageBlocks[1].find((b) => b.line === 37);
    expect(intro).toBeDefined();
    expect(intro!.width).toBeGreaterThan(0);
    expect(intro!.height).toBeGreaterThan(0);
  });

  it("clicking introduction body resolves to introduction, not abstract", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);

    const introClickY = 306;
    const h = canvasHeight(viewport);
    const [synctexX, synctexY] = viewportClickToSynctexPoint(72, introClickY, viewport, h);
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);

    expect(synctexY).toBeCloseTo(introClickY, 0);
    expect(hit).toEqual({ line: 37, file: "main.tex" });
    expect(hit?.line).not.toBe(29);
  });

  it("clicking conclusion body resolves to conclusion, not related work", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);

    const conclusionClickY = 422;
    const [synctexX, synctexY] = viewportClickToSynctexPoint(
      72,
      conclusionClickY,
      viewport,
      canvasHeight(viewport)
    );
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);

    expect(hit).toEqual({ line: 53, file: "main.tex" });
    expect(hit?.line).not.toBe(41);
    expect(hit?.line).not.toBe(58);
  });

  it("raw pdf.js Y (no flip) lands on the wrong section", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);

    const introClickY = 306;
    const [, pdfY] = viewport.convertToPdfPoint(72, introClickY);
    const introWrong = findSynctexSource(index, 1, 72, pdfY, ["main.tex"]);
    expect(introWrong?.line).not.toBe(37);

    const conclusionClickY = 422;
    const [, pdfY2] = viewport.convertToPdfPoint(72, conclusionClickY);
    const conclusionWrong = findSynctexSource(index, 1, 72, pdfY2, ["main.tex"]);
    expect(conclusionWrong?.line).not.toBe(53);
  });

  it("returns null when the nearest block is beyond the distance threshold", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const hit = findSynctexSource(index, 1, 72, 72, ["main.tex"], 1);
    expect(hit).toBeNull();
  });

  it("skips container v/h blocks so a tall vertical box cannot steal clicks", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    index.pageBlocks[1].push({
      type: "v",
      fileNumber: 1,
      filePath: "main.tex",
      line: 12,
      left: 0,
      bottom: 400,
      width: 200,
      height: 350,
      page: 1,
    });

    const viewport = letterViewport(1);
    const [synctexX, synctexY] = viewportClickToSynctexPoint(
      72,
      306,
      viewport,
      canvasHeight(viewport)
    );
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);
    expect(hit?.line).toBe(37);
  });
});

describe("compiled IEEEtran fixture (pdflatex synctex)", () => {
  it("maps introduction body and related-work heading to the correct source lines", async () => {
    const synctexText = gunzipSync(readFileSync(join(FIXTURES, "ieee-main.synctex.gz"))).toString(
      "latin1"
    );
    const index = parseSynctex(synctexText);
    expect(index).not.toBeNull();

    const pdfData = new Uint8Array(readFileSync(join(FIXTURES, "ieee-main.pdf")));
    const pdf = await getDocument({ data: pdfData }).promise;
    const page = await pdf.getPage(1);
    const scale = 0.95;
    const viewport = page.getViewport({ scale, rotation: page.rotate });

    const byLine: Record<number, (typeof index!.pageBlocks)[1]> = {};
    for (const b of index!.pageBlocks[1] || []) {
      (byLine[b.line] ||= []).push(b);
    }

    function clickForLine(line: number) {
      const block = byLine[line]?.[0];
      expect(block).toBeDefined();
      const synctexY = block!.bottom - block!.height / 2;
      const pdfY = getPdfPageHeight(page) - synctexY;
      const [vx, vy] = viewport.convertToViewportPoint(block!.left + 4, pdfY);
      return viewportClickToSynctexPoint(vx, vy, viewport, canvasHeight(viewport));
    }

    const intro = findSynctexSource(index!, 1, ...clickForLine(32), ["main.tex"]);
    expect(intro?.line).toBe(32);
    expect(intro?.line).not.toBe(30);

    const related = findSynctexSource(index!, 1, ...clickForLine(34), ["main.tex"]);
    expect(related?.line).toBe(34);
    expect(related?.line).not.toBe(32);
  });
});

describe("production-layout 2-page fixture (page-1 blank, page-2 paper)", () => {
  const PREAMBLE_LINES = [5, 6, 7, 8, 9, 10, 11];
  const scale = 0.95;

  function loadProdIndex() {
    const synctexText = gunzipSync(
      readFileSync(join(FIXTURES, "ieee-prod-two-page.synctex.gz"))
    ).toString("latin1");
    return parseSynctex(synctexText)!;
  }

  async function loadProdPage2() {
    const pdfData = new Uint8Array(readFileSync(join(FIXTURES, "ieee-prod-two-page.pdf")));
    const pdf = await getDocument({ data: pdfData }).promise;
    expect(pdf.numPages).toBe(2);
    return pdf.getPage(2);
  }

  function synctexPointForCanvasClick(
    pdfPage: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>>["promise"]["getPage"]>>,
    clickX: number,
    clickY: number
  ) {
    const viewport = pdfPage.getViewport({ scale, rotation: pdfPage.rotate });
    return viewportClickToSynctexPoint(clickX, clickY, viewport, canvasHeight(viewport));
  }

  it("documents that preamble lines 7/8/11 exist only on synctex page 1", () => {
    const index = loadProdIndex();
    for (const line of [7, 8, 11]) {
      expect(index.pageBlocks[1]?.some((b) => b.line === line)).toBe(true);
      expect(index.pageBlocks[2]?.some((b) => b.line === line) ?? false).toBe(false);
    }
  });

  it("explains production preamble landings with coordinates (page-1 lookup + collapsed Y)", async () => {
    const index = loadProdIndex();
    const page2 = await loadProdPage2();

    const [introX, introY] = synctexPointForCanvasClick(page2, 120, 280);
    const introOk = explainSynctexLookup(index, 2, introX, introY, ["main.tex"]);
    expect(introOk.hit?.line).toBe(40);
    expect(PREAMBLE_LINES).not.toContain(introOk.hit?.line);

    const [collapsedX, collapsedY] = synctexPointForCanvasClick(page2, 120, 55);
    expect(collapsedY).toBeLessThan(80);

    const wrongPage = explainSynctexLookup(index, 1, collapsedX, collapsedY, ["main.tex"]);
    expect(wrongPage.hit?.line).toBe(10);
    expect(wrongPage.chosenBlock?.page).toBe(1);
    expect(wrongPage.chosenBlock?.top).toBeCloseTo(52, 0);

    const relatedBand = explainSynctexLookup(index, 1, 118, collapsedY + 5, ["main.tex"]);
    expect(relatedBand.hit?.line).toBe(10);

    const rightPageCollapsed = explainSynctexLookup(index, 2, collapsedX, collapsedY, ["main.tex"]);
    expect(PREAMBLE_LINES).not.toContain(rightPageCollapsed.hit?.line);
    expect(rightPageCollapsed.hit?.line === 28 || rightPageCollapsed.hit === null).toBe(true);
  });

  it("maps fixed page-2 intro body click to Introduction, not preamble", async () => {
    const index = loadProdIndex();
    const page2 = await loadProdPage2();
    const [synctexX, synctexY] = synctexPointForCanvasClick(page2, 120, 280);
    const hit = explainSynctexLookup(index, 2, synctexX, synctexY, ["main.tex"]);

    expect(hit.lookupPage).toBe(2);
    expect(hit.synctexY).toBeGreaterThan(200);
    expect(hit.hit?.line).toBe(40);
    expect(hit.hit?.line).toBeGreaterThanOrEqual(38);
    expect(PREAMBLE_LINES).not.toContain(hit.hit?.line);
  });

  it("does not resolve page-2 body clicks against page-1 preamble blocks", async () => {
    const index = loadProdIndex();
    const page2 = await loadProdPage2();
    const [synctexX, synctexY] = synctexPointForCanvasClick(page2, 120, 340);

    const wrongPage = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);
    expect(wrongPage).toBeNull();

    const correctPage = findSynctexSource(index, 2, synctexX, synctexY, ["main.tex"]);
    expect(correctPage?.line).toBe(48);
    expect(PREAMBLE_LINES).not.toContain(correctPage?.line);
  });
});
