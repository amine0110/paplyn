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
 * LaTeX-Workshop reverse sync uses `getPagePoint(x, canvasHeight - y)` and passes the
 * resulting pdf.js point directly into synctex lookup. Use the canvas CSS height from
 * `getBoundingClientRect()`, not `viewport.height`, so the flip matches the painted pixels.
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
 * `canvasHeight` must be the canvas CSS height (`getBoundingClientRect().height`).
 */
export function viewportClickToSynctexPoint(
  clickX: number,
  clickY: number,
  viewport: PdfViewportLike,
  canvasHeight: number
): [number, number] {
  const h = Math.floor(canvasHeight);
  const [pdfX, pdfY] = viewport.convertToPdfPoint(clickX, h - clickY);
  return [pdfX, pdfY];
}

/** End-to-end: browser click on the canvas → global SyncTeX lookup point. */
export function clientClickToSynctexPoint(
  clientX: number,
  clientY: number,
  pageRect: Pick<DOMRectReadOnly, "left" | "top" | "height">,
  viewport: PdfViewportLike
): [number, number] {
  const { x, y } = domClickOffset(clientX, clientY, pageRect);
  return viewportClickToSynctexPoint(x, y, viewport, pageRect.height);
}
