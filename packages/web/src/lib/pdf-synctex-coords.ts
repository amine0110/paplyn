/**
 * Map PDF viewer click coordinates to SyncTeX lookup coordinates.
 *
 * Coordinate spaces:
 * - DOM / canvas clicks: CSS pixels, origin at the canvas top-left.
 * - pdf.js `convertToPdfPoint`: PDF user space (origin bottom-left, Y increases upward).
 * - SyncTeX block geometry: page-local points, origin at the page top-left, Y increases
 *   downward (see SyncTeX README). The file's X/Y Offset records shift between pdf.js
 *   global coordinates and page-local block coordinates; `findSynctexSource` subtracts them.
 *
 * LaTeX-Workshop reverse sync uses `getPagePoint(x, canvasHeight - y)`, which is equivalent
 * to converting the click then flipping Y with the page media box:
 *   synctexY = pageView[3] - pdfY
 */

export interface PdfViewportLike {
  width: number;
  height: number;
  convertToPdfPoint: (x: number, y: number) => number[];
}

export interface PdfPageViewLike {
  /** PDF page view box `[xMin, yMin, xMax, yMax]` in user-space points. */
  view: number[];
}

/** Media box height in PDF points (`view[3] - view[1]`). */
export function getPdfPageHeight(page: PdfPageViewLike): number {
  return page.view[3] - page.view[1];
}

/** Offset of a DOM click relative to the rendered page element (canvas). */
export function domClickOffset(
  clientX: number,
  clientY: number,
  pageRect: Pick<DOMRectReadOnly, "left" | "top">
): { x: number; y: number } {
  return {
    x: clientX - pageRect.left,
    y: clientY - pageRect.top,
  };
}

/**
 * Convert a click on the rendered PDF page to global SyncTeX (x, y) in PDF points.
 * `clickX`/`clickY` must be relative to the page canvas origin (top-left, CSS pixels).
 *
 * Uses the canvas CSS height for sanity checks; conversion is driven by the viewport
 * transform and `pageView[3] - pdfY` (distance from the page top).
 */
export function viewportClickToSynctexPoint(
  clickX: number,
  clickY: number,
  viewport: PdfViewportLike,
  pageView: number[]
): [number, number] {
  const [pdfX, pdfY] = viewport.convertToPdfPoint(clickX, clickY);
  const synctexY = pageView[3] - pdfY;
  return [pdfX, synctexY];
}

/** End-to-end: browser click on the canvas → global SyncTeX lookup point. */
export function clientClickToSynctexPoint(
  clientX: number,
  clientY: number,
  pageRect: Pick<DOMRectReadOnly, "left" | "top">,
  viewport: PdfViewportLike,
  pageView: number[]
): [number, number] {
  const { x, y } = domClickOffset(clientX, clientY, pageRect);
  return viewportClickToSynctexPoint(x, y, viewport, pageView);
}
