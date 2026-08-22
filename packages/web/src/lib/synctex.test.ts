import { describe, it, expect } from "vitest";
import { gzipSync } from "zlib";
import {
  decodeSynctexBase64,
  findSynctexSource,
  isGzipSynctex,
  parseSynctex,
  resolveSynctexFilePath,
  synctexLookupFromBase64,
} from "./synctex";
import { type PdfViewportLike, viewportClickToSynctexPoint } from "./pdf-synctex-coords";

/** Minimal SyncTeX fixture: page 1 maps (72, 742) pt → main.tex line 10. */
const SAMPLE_SYNCTEX = [
  "SyncTeX version:1",
  "Input:1:main.tex",
  "Output:pdf",
  "{1",
  "[1,5:4736287,48814067:1000000,2000000,0",
  "x1,10:4736287,48814067",
  "]",
  "}1",
].join("\n");

const LETTER_VIEW = [0, 0, 612, 792] as const;
const SYNCTEX_OFFSET_SP = 4736287; // 72pt

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

/** Page-local block coords with 72pt synctex offset (see synctex spec). */
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

describe("parseSynctex", () => {
  it("parses input files and page element blocks", () => {
    const index = parseSynctex(SAMPLE_SYNCTEX);
    expect(index).not.toBeNull();
    expect(index!.files["1"]).toBe("main.tex");
    expect(index!.pageBlocks[1]).toHaveLength(1);
    expect(index!.pageBlocks[1][0].line).toBe(10);
  });

  it("returns null for empty input", () => {
    expect(parseSynctex("")).toBeNull();
    expect(parseSynctex("SyncTeX version:1\nInput:1:main.tex")).toBeNull();
  });
});

describe("findSynctexSource", () => {
  it("finds the nearest source line for a PDF point on the page", () => {
    const index = parseSynctex(SAMPLE_SYNCTEX)!;
    const hit = findSynctexSource(index, 1, 72, 742, ["main.tex"]);
    expect(hit).toEqual({ line: 10, file: "main.tex" });
  });

  it("returns null when the page has no blocks", () => {
    const index = parseSynctex(SAMPLE_SYNCTEX)!;
    expect(findSynctexSource(index, 2, 72, 742, ["main.tex"])).toBeNull();
  });

  it("returns null when the nearest block is beyond the distance threshold", () => {
    const index = parseSynctex(SAMPLE_SYNCTEX)!;
    expect(findSynctexSource(index, 1, 0, 0, ["main.tex"], 1)).toBeNull();
  });

  it("resolves introduction click (Y=306) to introduction, not abstract", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    const viewport = letterViewport(1);
    const introClickY = 306;
    const [synctexX, synctexY] = viewportClickToSynctexPoint(
      72,
      introClickY,
      viewport,
      canvasHeight(viewport)
    );
    const hit = findSynctexSource(index, 1, synctexX, synctexY, ["main.tex"]);

    expect(synctexY).toBeCloseTo(introClickY, 0);
    expect(hit).toEqual({ line: 37, file: "main.tex" });
    expect(hit?.line).not.toBe(29);
  });

  it("resolves conclusion click (Y=422) to conclusion, not related work", () => {
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
  });

  it("maps a Y value ~25pt too high to the prior section (regression guard)", () => {
    const index = parseSynctex(ieeeSynctexFixture())!;
    // Correct intro click ≈306; off-by-25pt lands in the abstract band.
    const hit = findSynctexSource(index, 1, 72, 240, ["main.tex"]);
    expect(hit?.line).toBe(29);
    expect(hit?.line).not.toBe(37);
  });
});

describe("resolveSynctexFilePath", () => {
  it("matches project files by basename or suffix", () => {
    expect(resolveSynctexFilePath("/tmp/work/main.tex", ["main.tex"])).toBe("main.tex");
    expect(resolveSynctexFilePath("/var/compile/chapters/intro.tex", ["chapters/intro.tex"])).toBe(
      "chapters/intro.tex"
    );
  });

  it("returns undefined when ambiguous or missing", () => {
    expect(resolveSynctexFilePath("main.tex", [])).toBeUndefined();
    expect(resolveSynctexFilePath("main.tex", ["a/main.tex", "b/main.tex"])).toBeUndefined();
  });
});

describe("decodeSynctexBase64", () => {
  it("decodes plain synctex base64", async () => {
    const base64 = Buffer.from(SAMPLE_SYNCTEX, "latin1").toString("base64");
    const text = await decodeSynctexBase64(base64);
    expect(text).toContain("Input:1:main.tex");
  });

  it("decodes gzip synctex base64", async () => {
    const gz = gzipSync(Buffer.from(SAMPLE_SYNCTEX, "latin1"));
    expect(isGzipSynctex(gz)).toBe(true);
    const base64 = gz.toString("base64");
    const text = await decodeSynctexBase64(base64);
    expect(text).toContain("x1,10:");
  });
});

describe("synctexLookupFromBase64", () => {
  it("performs end-to-end reverse lookup from base64 payload", async () => {
    const base64 = Buffer.from(SAMPLE_SYNCTEX, "latin1").toString("base64");
    const hit = await synctexLookupFromBase64(base64, 1, 72, 742, ["main.tex"]);
    expect(hit).toEqual({ line: 10, file: "main.tex" });
  });

  it("returns null for invalid base64", async () => {
    expect(await synctexLookupFromBase64("not-valid!!!", 1, 0, 0)).toBeNull();
  });
});
