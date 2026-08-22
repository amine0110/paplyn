import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { gunzipSync } from "zlib";
import { getDocument } from "pdfjs-dist/build/pdf.mjs";
import {
  clientClickToSynctexPoint,
  domClickOffset,
  getPdfPageHeight,
  type PdfViewportLike,
  viewportClickToSynctexPoint,
} from "./pdf-synctex-coords";
import { findSynctexSource, parseSynctex } from "./synctex";

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

    const topClick = viewportClickToSynctexPoint(100, 0, viewport, [...LETTER_VIEW]);
    const bottomClick = viewportClickToSynctexPoint(100, viewport.height, viewport, [
      ...LETTER_VIEW,
    ]);

    expect(topClick[1]).toBeLessThan(bottomClick[1]);
    expect(topClick[1]).toBeCloseTo(0, 0);
    expect(bottomClick[1]).toBeCloseTo(PAGE_HEIGHT, 0);
  });

  it("uses pageView[3] - pdfY (equivalent to LaTeX-Workshop getPagePoint flip)", () => {
    const viewport = letterViewport(0.95);
    const clickX = 120;
    const clickY = 40;
    const [synctexX, synctexY] = viewportClickToSynctexPoint(clickX, clickY, viewport, [
      ...LETTER_VIEW,
    ]);
    const [, pdfY] = viewport.convertToPdfPoint(clickX, clickY);
    expect(synctexX).toBeCloseTo(clickX / 0.95, 5);
    expect(synctexY).toBeCloseTo(LETTER_VIEW[3] - pdfY, 5);
    expect(synctexY).toBeCloseTo(clickY / 0.95, 1);
  });

  it("documents floor(canvasHeight) vs viewport.height flip delta at fractional scales", () => {
    const viewport = letterViewport(0.95);
    const clickX = 120;
    const clickY = 40;
    const canvasHeight = Math.floor(viewport.height);
    const [, flipY] = viewport.convertToPdfPoint(clickX, canvasHeight - clickY);
    const [, synctexY] = viewportClickToSynctexPoint(clickX, clickY, viewport, [...LETTER_VIEW]);
    // pageView[3] - pdfY avoids canvasHeight rounding error from Math.floor(viewport.height).
    expect(Math.abs(synctexY - flipY)).toBeLessThan(1);
  });

  it("scales with viewport zoom", () => {
    const viewport = letterViewport(1.5);
    const [x, y] = viewportClickToSynctexPoint(
      viewport.width / 2,
      viewport.height / 2,
      viewport,
      [...LETTER_VIEW]
    );
    expect(x).toBeCloseTo(LETTER_VIEW[2] / 2, 0);
    expect(y).toBeCloseTo(PAGE_HEIGHT / 2, 0);
  });
});

describe("clientClickToSynctexPoint", () => {
  it("uses the canvas bounding rect rather than a padded wrapper", () => {
    const viewport = letterViewport(1);
    const canvasRect = { left: 80, top: 40 };

    const fromCanvas = clientClickToSynctexPoint(
      canvasRect.left + 72,
      canvasRect.top + 50,
      canvasRect,
      viewport,
      [...LETTER_VIEW]
    );
    const fromWrapper = clientClickToSynctexPoint(
      canvasRect.left + 72,
      canvasRect.top + 50,
      { left: 0, top: 40 },
      viewport,
      [...LETTER_VIEW]
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
    const [synctexX, synctexY] = viewportClickToSynctexPoint(72, introClickY, viewport, [
      ...LETTER_VIEW,
    ]);
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);

    expect(synctexY).toBeCloseTo(introClickY, 0);
    expect(hit).toEqual({ line: 37, file: "main.tex" });
    expect(hit?.line).not.toBe(29);
  });

  it("clicking conclusion body resolves to conclusion, not related work", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);

    const conclusionClickY = 422;
    const [synctexX, synctexY] = viewportClickToSynctexPoint(72, conclusionClickY, viewport, [
      ...LETTER_VIEW,
    ]);
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
    const [synctexX, synctexY] = viewportClickToSynctexPoint(72, 306, viewport, [
      ...LETTER_VIEW,
    ]);
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
      return viewportClickToSynctexPoint(vx, vy, viewport, page.view);
    }

    const intro = findSynctexSource(index!, 1, ...clickForLine(32), ["main.tex"]);
    expect(intro?.line).toBe(32);
    expect(intro?.line).not.toBe(30);

    const related = findSynctexSource(index!, 1, ...clickForLine(34), ["main.tex"]);
    expect(related?.line).toBe(34);
    expect(related?.line).not.toBe(32);
  });
});
