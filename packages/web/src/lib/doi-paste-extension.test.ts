import { describe, expect, it } from "vitest";
import { extractDoi } from "./doi-citation";
import { createDoiPasteExtension } from "./doi-paste-extension";

describe("doi-paste-extension", () => {
  it("extracts DOI from pasted text", () => {
    expect(extractDoi("10.1038/nature12373")).toBe("10.1038/nature12373");
  });

  it("creates a paste handler extension", () => {
    const extension = createDoiPasteExtension(() => {});
    expect(extension).toBeDefined();
  });
});
