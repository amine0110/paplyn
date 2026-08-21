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
const SYNCTEX_Y_OFFSET_SP = 4736287;

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

/** IEEE-style 1-page fixture: abstract, intro, and conclusion blocks on page 1. */
function ieeeSynctexFixture(): string {
  const left = sp(72);
  const abstractBottom = sp(300);
  const introBottom = sp(400);
  const conclusionBottom = sp(120);

  return [
    "SyncTeX version:1",
    "Input:1:main.tex",
    "Output:pdf",
    `X Offset:${SYNCTEX_Y_OFFSET_SP}`,
    `Y Offset:${SYNCTEX_Y_OFFSET_SP}`,
    "{1",
    `[1,29:${left},${abstractBottom}:1000000,1200000,0`,
    `x1,29:${left},${abstractBottom}`,
    "]",
    `[1,37:${left},${introBottom}:1000000,1200000,0`,
    `x1,37:${left},${introBottom}`,
    "]",
    `[1,53:${left},${conclusionBottom}:1000000,1200000,0`,
    `x1,53:${left},${conclusionBottom}`,
    "]",
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
  it("returns pdf.js PDF user-space coordinates without flipping Y", () => {
    const viewport = letterViewport(1);

    const topClick = viewportClickToSynctexPoint(100, 0, viewport);
    const bottomClick = viewportClickToSynctexPoint(100, viewport.height, viewport);

    expect(topClick[1]).toBeGreaterThan(bottomClick[1]);
    expect(topClick[1]).toBeCloseTo(PAGE_HEIGHT, 0);
    expect(bottomClick[1]).toBeCloseTo(0, 0);
  });

  it("preserves X and Y from convertToPdfPoint", () => {
    const viewport = letterViewport(0.95);
    const [pdfX, pdfY] = viewport.convertToPdfPoint(120, 40);
    const [synctexX, synctexY] = viewportClickToSynctexPoint(120, 40, viewport);
    expect(synctexX).toBeCloseTo(pdfX, 5);
    expect(synctexY).toBeCloseTo(pdfY, 5);
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
  it("clicking introduction body must not resolve to abstract (IEEE 1-page regression)", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);

    const introClickY = 320;
    const [synctexX, synctexY] = viewportClickToSynctexPoint(72, introClickY, viewport);
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);

    expect(synctexY).toBeCloseTo(PAGE_HEIGHT - introClickY, 0);
    expect(hit).toEqual({ line: 37, file: "main.tex" });
    expect(hit?.line).not.toBe(29);
  });

  it("clicking conclusion body resolves to conclusion, not related work", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);

    const conclusionClickY = 650;
    const [synctexX, synctexY] = viewportClickToSynctexPoint(72, conclusionClickY, viewport);
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);

    expect(hit).toEqual({ line: 53, file: "main.tex" });
    expect(hit?.line).not.toBe(37);
  });

  it("pageHeight - pdfY flip systematically picks the section above the click", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);
    const introClickY = 320;

    const [pdfX, pdfY] = viewport.convertToPdfPoint(72, introClickY);
    const flippedY = PAGE_HEIGHT - pdfY;
    const wrong = findSynctexSource(index, 1, pdfX, flippedY, ["main.tex"]);

    expect(flippedY).toBeCloseTo(introClickY, 0);
    expect(wrong).toEqual({ line: 29, file: "main.tex" });
  });
});
