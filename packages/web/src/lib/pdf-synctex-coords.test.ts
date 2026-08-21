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
  it("flips pdf.js bottom-left Y into SyncTeX top-left Y", () => {
    const viewport = letterViewport(1);
    const pageHeight = getPdfPageHeight({ view: [...LETTER_VIEW] });

    const topClick = viewportClickToSynctexPoint(100, 0, viewport, pageHeight);
    const bottomClick = viewportClickToSynctexPoint(100, viewport.height, viewport, pageHeight);

    expect(topClick[1]).toBeLessThan(bottomClick[1]);
    expect(topClick[1]).toBeCloseTo(0, 0);
    expect(bottomClick[1]).toBeCloseTo(pageHeight, 0);
  });

  it("preserves X from convertToPdfPoint", () => {
    const viewport = letterViewport(0.95);
    const [pdfX] = viewport.convertToPdfPoint(120, 40);
    const [synctexX] = viewportClickToSynctexPoint(120, 40, viewport, PAGE_HEIGHT);
    expect(synctexX).toBeCloseTo(pdfX, 5);
  });

  it("scales with viewport zoom", () => {
    const viewport = letterViewport(1.5);
    const [x, y] = viewportClickToSynctexPoint(viewport.width / 2, viewport.height / 2, viewport, PAGE_HEIGHT);
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
      PAGE_HEIGHT
    );
    const fromWrapper = clientClickToSynctexPoint(
      canvasRect.left + 72,
      canvasRect.top + 50,
      { left: 0, top: 40 },
      viewport,
      PAGE_HEIGHT
    );

    expect(fromCanvas[0]).toBeCloseTo(72, 5);
    expect(fromWrapper[0]).not.toBeCloseTo(72, 5);
  });
});

describe("synctex lookup with converted click coordinates", () => {
  it("finds the body line only after flipping Y into SyncTeX space", () => {
    const fixture = [
      "SyncTeX version:1",
      "Input:1:main.tex",
      "Output:pdf",
      "{1",
      "[1,8:4736287,1315635:1000000,2000000,0",
      "x1,8:4736287,1315635",
      "]",
      "[1,37:4736287,52556352:1000000,2000000,0",
      "x1,37:4736287,52556352",
      "]",
      "}1",
    ].join("\n");
    const index = parseSynctex(fixture)!;
    const viewport = letterViewport(1);

    const bodyClickY = 666;
    const [pdfX, pdfY] = viewport.convertToPdfPoint(72, bodyClickY);
    const wrong = findSynctexSource(index, 1, pdfX, pdfY, ["main.tex"]);

    const [synctexX, synctexY] = viewportClickToSynctexPoint(72, bodyClickY, viewport, PAGE_HEIGHT);
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);

    expect(synctexY).toBeCloseTo(666, 0);
    expect(hit).toEqual({ line: 37, file: "main.tex" });
    expect(wrong).toEqual({ line: 8, file: "main.tex" });
  });
});
