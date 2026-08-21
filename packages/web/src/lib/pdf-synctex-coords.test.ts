import { describe, it, expect } from "vitest";
import {
  clientClickToSynctexPoint,
  domClickOffset,
  getPdfPageHeight,
  type PdfViewportLike,
  viewportClickToSynctexPoint,
} from "./pdf-synctex-coords";
import { findSynctexSource, parseSynctex } from "./synctex";

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
 * IEEE-style 1-page fixture with SyncTeX top-left Y-down block geometry.
 * Block coordinates match TeX Live absolute page space (same as converted clicks).
 */
function ieeeSynctexFixture(): string {
  const left = sp(72);
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
    ...block(12, 180),
    ...block(29, 250),
    ...block(37, 320),
    ...block(41, 420),
    ...block(53, 442),
    ...block(58, 700),
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

    const topClick = viewportClickToSynctexPoint(100, 0, viewport);
    const bottomClick = viewportClickToSynctexPoint(100, viewport.height, viewport);

    expect(topClick[1]).toBeLessThan(bottomClick[1]);
    expect(topClick[1]).toBeCloseTo(0, 0);
    expect(bottomClick[1]).toBeCloseTo(PAGE_HEIGHT, 0);
  });

  it("matches LaTeX-Workshop getPagePoint(x, canvasHeight - top)", () => {
    const viewport = letterViewport(0.95);
    const clickX = 120;
    const clickY = 40;
    const [synctexX, synctexY] = viewportClickToSynctexPoint(clickX, clickY, viewport);
    const [pageX, pageY] = viewport.convertToPdfPoint(clickX, viewport.height - clickY);
    expect(synctexX).toBeCloseTo(pageX, 5);
    expect(synctexY).toBeCloseTo(pageY, 5);
    expect(synctexY).toBeCloseTo(clickY / 0.95, 1);
  });

  it("scales with viewport zoom", () => {
    const viewport = letterViewport(1.5);
    const [x, y] = viewportClickToSynctexPoint(viewport.width / 2, viewport.height / 2, viewport);
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
      viewport
    );
    const fromWrapper = clientClickToSynctexPoint(
      canvasRect.left + 72,
      canvasRect.top + 50,
      { left: 0, top: 40 },
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
    const intro = index.pageBlocks[1].find((b) => b.line === 37);
    expect(intro).toBeDefined();
    expect(intro!.width).toBeGreaterThan(0);
    expect(intro!.height).toBeGreaterThan(0);
  });

  it("clicking introduction body resolves to introduction, not abstract", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);

    const introClickY = 306;
    const [synctexX, synctexY] = viewportClickToSynctexPoint(72, introClickY, viewport);
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);

    expect(synctexY).toBeCloseTo(introClickY, 0);
    expect(hit).toEqual({ line: 37, file: "main.tex" });
    expect(hit?.line).not.toBe(29);
  });

  it("clicking conclusion body resolves to conclusion, not bibliography", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);

    const conclusionClickY = 422;
    const [synctexX, synctexY] = viewportClickToSynctexPoint(72, conclusionClickY, viewport);
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);

    expect(hit).toEqual({ line: 53, file: "main.tex" });
    expect(hit?.line).not.toBe(58);
  });

  it("raw pdf.js Y (no flip) does not resolve introduction or conclusion clicks", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);

    const introClickY = 306;
    const [pdfX, pdfY] = viewport.convertToPdfPoint(72, introClickY);
    const introWrong = findSynctexSource(index, 1, pdfX, pdfY, ["main.tex"]);
    expect(introWrong?.line).not.toBe(37);

    const conclusionClickY = 422;
    const [pdfX2, pdfY2] = viewport.convertToPdfPoint(72, conclusionClickY);
    const conclusionWrong = findSynctexSource(index, 1, pdfX2, pdfY2, ["main.tex"]);
    expect(conclusionWrong?.line).not.toBe(53);
  });

  it("returns null when the nearest block is beyond the distance threshold", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const hit = findSynctexSource(index, 1, 72, 72, ["main.tex"], 1);
    expect(hit).toBeNull();
  });
});
