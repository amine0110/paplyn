import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import * as Yesm from "yjs";
import Y from "./yjs.js";
import { isYTextLike, replaceYTextContent } from "./y-text.js";

const require = createRequire(import.meta.url);
const Ycjs = require("yjs") as typeof import("yjs");

describe("isYTextLike", () => {
  it("accepts ESM Y.Text", () => {
    const doc = new Y.Doc();
    expect(isYTextLike(doc.getText("main.tex"))).toBe(true);
  });

  it("accepts CJS Y.Text when ESM instanceof fails (dual Yjs realm)", () => {
    const doc = new Ycjs.Doc();
    const ytext = doc.getText("main.tex");
    ytext.insert(0, "hello");
    expect(ytext instanceof Yesm.Text).toBe(false);
    expect(isYTextLike(ytext)).toBe(true);
  });

  it("rejects Y.Map and plain objects", () => {
    const doc = new Y.Doc();
    expect(isYTextLike(doc.getMap("_meta"))).toBe(false);
    expect(isYTextLike({ toString: () => "x" })).toBe(false);
  });
});

describe("replaceYTextContent", () => {
  it("replaces existing Y.Text content atomically", () => {
    const doc = new Y.Doc();
    const ytext = doc.getText("main.tex");
    ytext.insert(0, "stale");
    replaceYTextContent(ytext, "fresh from http");
    expect(ytext.toString()).toBe("fresh from http");
  });
});
