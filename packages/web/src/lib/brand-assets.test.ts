import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

const BRAND_DIR = join(process.cwd(), "public", "brand");

function readPngRgbaPixel(
  filePath: string,
  x: number,
  y: number
): [number, number, number, number] {
  const buf = readFileSync(filePath);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i++) {
    expect(buf[i]).toBe(signature[i]);
  }

  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idatChunks: Buffer[] = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    pos += 4;
    const type = buf.toString("ascii", pos, pos + 4);
    pos += 4;
    const data = buf.subarray(pos, pos + len);
    pos += len + 4;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
  }

  expect(colorType).toBe(6);
  expect(bitDepth).toBe(8);

  const raw = inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const out = Buffer.alloc(height * width * bpp);
  const prev = Buffer.alloc(width * bpp);
  let rawOff = 0;
  let outOff = 0;

  for (let row = 0; row < height; row++) {
    const filter = raw[rawOff++];
    const rowData = raw.subarray(rawOff, rawOff + width * bpp);
    rawOff += width * bpp;
    const cur = Buffer.alloc(width * bpp);

    for (let i = 0; i < width * bpp; i++) {
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let val = rowData[i];

      switch (filter) {
        case 0:
          break;
        case 1:
          val = (val + left) & 0xff;
          break;
        case 2:
          val = (val + up) & 0xff;
          break;
        case 3:
          val = (val + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          val = (val + pr) & 0xff;
          break;
        }
        default:
          throw new Error(`Unknown PNG filter ${filter}`);
      }

      cur[i] = val;
    }

    cur.copy(out, outOff);
    cur.copy(prev);
    outOff += width * bpp;
  }

  const idx = (y * width + x) * 4;
  return [out[idx], out[idx + 1], out[idx + 2], out[idx + 3]];
}

function expectTransparentRgbaCorners(fileName: string): void {
  const filePath = join(BRAND_DIR, fileName);
  const buf = readFileSync(filePath);
  expect(buf[25]).toBe(6);

  const corners: Array<[number, number]> = [
    [0, 0],
    [0, 1],
    [1, 0],
  ];

  for (const [x, y] of corners) {
    const [, , , alpha] = readPngRgbaPixel(filePath, x, y);
    expect(alpha).toBe(0);
  }
}

describe("brand assets", () => {
  it("keeps paplyn-mark.png as RGBA with transparent corners", () => {
    expectTransparentRgbaCorners("paplyn-mark.png");
  });

  it("keeps favicon-32.png on a transparent square canvas", () => {
    expectTransparentRgbaCorners("favicon-32.png");
  });
});
