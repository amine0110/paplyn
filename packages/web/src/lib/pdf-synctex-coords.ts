/**
 * Map PDF viewer click coordinates to SyncTeX lookup coordinates.
 *
 * pdf.js viewports use DOM space (origin top-left). `convertToPdfPoint` returns
 * PDF user space (origin bottom-left, Y up). SyncTeX stores geometry with a
 * top-left origin and Y increasing downward (see SyncTeX README). LaTeX-Workshop
 * uses `getPagePoint(x, canvasHeight - y)` for reverse sync; the equivalent here
 * is `convertToPdfPoint(clickX, viewport.height - clickY)`.
 */

export interface PdfViewportLike {
  width: number;
  height: number;
  convertToPdfPoint: (x: number, y: number) => number[];
}

export interface PdfPageViewLike {
  /** PDF page view box `[xMin, yMin, xMax, yMax]` in user space points. */
  view: number[];
}

/** Media box height in PDF points. */
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
 * Convert a click on the rendered PDF page to SyncTeX (x, y) in points.
 * `clickX`/`clickY` must be relative to the page canvas origin (top-left).
 */
export function viewportClickToSynctexPoint(
  clickX: number,
  clickY: number,
  viewport: PdfViewportLike
): [number, number] {
  const [synctexX, synctexY] = viewport.convertToPdfPoint(
    clickX,
    viewport.height - clickY
  );
  return [synctexX, synctexY];
}

/** End-to-end: browser click on the canvas → SyncTeX lookup point. */
export function clientClickToSynctexPoint(
  clientX: number,
  clientY: number,
  pageRect: Pick<DOMRectReadOnly, "left" | "top">,
  viewport: PdfViewportLike
): [number, number] {
  const { x, y } = domClickOffset(clientX, clientY, pageRect);
  return viewportClickToSynctexPoint(x, y, viewport);
}
