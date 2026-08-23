import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import * as Yesm from "yjs";
import Y from "./yjs.js";
import { applyDocState, encodeDocState } from "./persistence.js";

const require = createRequire(import.meta.url);
/** CJS yjs — same entry point y-websocket/bin/utils loads. */
const Ycjs = require("yjs") as typeof import("yjs");

describe("Yjs single realm (server)", () => {
  it("server yjs module is the same CJS instance y-websocket uses", () => {
    expect(Y.Doc).toBe(Ycjs.Doc);
    expect(Y.Text).toBe(Ycjs.Text);
    expect(Y.encodeStateAsUpdate).toBe(Ycjs.encodeStateAsUpdate);
    expect(Y.applyUpdate).toBe(Ycjs.applyUpdate);
  });

  it("ESM yjs is a different realm — do not use for server doc encode/apply", () => {
    expect(Y.Doc).not.toBe(Yesm.Doc);

    const serverDoc = new Y.Doc();
    serverDoc.getText("main.tex").insert(0, "server");
    const ytext = serverDoc.getText("main.tex");

    expect(ytext instanceof Y.Text).toBe(true);
    expect(ytext instanceof Yesm.Text).toBe(false);
    expect(ytext instanceof Ycjs.Text).toBe(true);
  });

  it("cross-realm encode/apply on the same doc corrupts restored content", () => {
    const serverDoc = new Y.Doc();
    serverDoc.getText("main.tex").insert(0, "live");

    // Pre-fix persistence imported ESM `yjs` for these helpers while y-websocket held CJS docs.
    const esmEncoded = Yesm.encodeStateAsUpdate(serverDoc as unknown as Yesm.Doc);
    const restored = new Y.Doc();
    Yesm.applyUpdate(restored as unknown as Yesm.Doc, esmEncoded);

    expect(restored.getText("main.tex").toString()).not.toBe("live");
    expect(restored.getText("main.tex") instanceof Yesm.Text).toBe(false);
    expect(restored.getText("main.tex") instanceof Y.Text).toBe(true);
  });

  it("single-realm encode/apply round-trips ~300k tex insert without throw", () => {
    const largeContent = "% ".repeat(150_000);
    const source = new Y.Doc();
    source.getText("main.tex").insert(0, largeContent);

    const restored = new Y.Doc();
    expect(() => applyDocState(restored, encodeDocState(source))).not.toThrow();
    expect(restored.getText("main.tex").toString()).toBe(largeContent);
    expect(restored.getText("main.tex").length).toBe(largeContent.length);
  });

  it("single-realm server doc accepts large client-style insert after restore", () => {
    const large = "% persist-ack\n" + "x".repeat(311_000);
    const storedDoc = new Y.Doc();
    storedDoc.getText("main.tex").insert(0, large.slice(0, 311_498));

    const serverDoc = new Y.Doc();
    applyDocState(serverDoc, encodeDocState(storedDoc));

    serverDoc.getText("main.tex").insert(serverDoc.getText("main.tex").length, "-86");
    expect(serverDoc.getText("main.tex").toString().endsWith("-86")).toBe(true);
    expect(() => encodeDocState(serverDoc)).not.toThrow();
  });
});
