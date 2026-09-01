import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-34/35 PDF continuous scroll and click-to-source deploy gate", () => {
  const pdfPreview = readSource("components/pdf-preview.tsx");

  it("PAP-34: stacks all pages in the scroll pane instead of a single pageNumber={page}", () => {
    expect(pdfPreview).toContain("pageNumbers.map");
    expect(pdfPreview).toContain("data-pdf-page={pageNumber}");
    expect(pdfPreview).toContain("pickPageNearestViewportTop");
    expect(pdfPreview).toContain("scrollToPage");
    expect(pdfPreview).not.toMatch(/<Page[\s\S]*pageNumber=\{page\}/);
    expect(pdfPreview).not.toMatch(/setPage\(page\s*[+-]\s*1\)/);
  });

  it("PAP-35: proof click delegates from the scroll container and uses per-page proxies", () => {
    expect(pdfPreview).toContain('canvas.closest("[data-pdf-page]")');
    expect(pdfPreview).toContain("pageProxyRefs.current.set(pdfPage.pageNumber, pdfPage)");
    expect(pdfPreview).toContain("synctexLookupFromBase64");
    expect(pdfPreview).toContain("onJumpToLine(location.line, location.file)");
    expect(pdfPreview).toContain("scrollAwareClickToSynctexPoint");
    expect(pdfPreview).toContain("buildPdfClickDomContext");
    expect(pdfPreview).toContain("cursor-crosshair");
    expect(pdfPreview).not.toContain("canvasRef");
    expect(pdfPreview).not.toContain("pageRef.current");
  });
});
