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
 * LaTeX-Workshop reverse sync (viewer/components/synctex.ts) computes canvas-local
 * coordinates with pageX/pageY and the scroll container's scrollTop/scrollLeft, then calls
 * getPagePoint(left, canvas.offsetHeight - top). Match that here — clientX/rect.height
 * alone is not equivalent when the proof pane scrolls.
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

/** Scroll-aware DOM context for a click on a react-pdf canvas inside a scroll container. */
export interface PdfClickDomContext {
  pageX: number;
  pageY: number;
  /** Element wrapping the react-pdf `<Page>` (offsetParent chain anchor). */
  pageOffsetLeft: number;
  pageOffsetTop: number;
  scrollLeft: number;
  scrollTop: number;
  canvasOffsetLeft: number;
  canvasOffsetTop: number;
  /** Use `canvas.offsetHeight` (integer CSS px), not bounding-rect height. */
  canvasOffsetHeight: number;
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
 * Canvas-local click offsets using the LaTeX-Workshop scroll-aware formula.
 * Returns coordinates relative to the canvas origin (top-left, CSS px).
 */
export function scrollAwareCanvasClickOffset(
  event: Pick<MouseEvent, "pageX" | "pageY">,
  dom: PdfClickDomContext
): { x: number; y: number; canvasHeight: number } {
  const x =
    event.pageX - dom.pageOffsetLeft + dom.scrollLeft - dom.canvasOffsetLeft;
  const y =
    event.pageY - dom.pageOffsetTop + dom.scrollTop - dom.canvasOffsetTop;
  return { x, y, canvasHeight: dom.canvasOffsetHeight };
}

/**
 * Convert a click on the rendered PDF page to global SyncTeX (x, y) in PDF points.
 * `clickX`/`clickY` must be relative to the page canvas origin (top-left, CSS pixels).
 * `canvasHeight` must be `canvas.offsetHeight` (integer CSS px).
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

/** Scroll-aware browser click → global SyncTeX lookup point (LaTeX-Workshop style). */
export function scrollAwareClickToSynctexPoint(
  event: Pick<MouseEvent, "pageX" | "pageY">,
  dom: PdfClickDomContext,
  viewport: PdfViewportLike
): [number, number] {
  const { x, y, canvasHeight } = scrollAwareCanvasClickOffset(event, dom);
  return viewportClickToSynctexPoint(x, y, viewport, canvasHeight);
}

/** End-to-end: browser click on the canvas → global SyncTeX lookup point (viewport coords). */
export function clientClickToSynctexPoint(
  clientX: number,
  clientY: number,
  pageRect: Pick<DOMRectReadOnly, "left" | "top" | "height">,
  viewport: PdfViewportLike
): [number, number] {
  const { x, y } = domClickOffset(clientX, clientY, pageRect);
  const canvasHeight = pageRect.height > 0 ? pageRect.height : Math.floor(viewport.height);
  return viewportClickToSynctexPoint(x, y, viewport, canvasHeight);
}

/** Build DOM context for a react-pdf canvas inside a scroll container. */
export function buildPdfClickDomContext(
  event: Pick<MouseEvent, "pageX" | "pageY">,
  canvas: HTMLElement,
  pageElement: HTMLElement,
  scrollContainer: HTMLElement
): PdfClickDomContext {
  return {
    pageX: event.pageX,
    pageY: event.pageY,
    pageOffsetLeft: pageElement.offsetLeft,
    pageOffsetTop: pageElement.offsetTop,
    scrollLeft: scrollContainer.scrollLeft,
    scrollTop: scrollContainer.scrollTop,
    canvasOffsetLeft: canvas.offsetLeft,
    canvasOffsetTop: canvas.offsetTop,
    canvasOffsetHeight: canvas.offsetHeight,
  };
}
