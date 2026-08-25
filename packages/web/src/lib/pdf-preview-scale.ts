/** Default PDF proof zoom: 50% on narrow viewports, 95% on desktop. */
export function getDefaultPdfScale(): number {
  if (typeof window === "undefined") return 0.95;
  return window.matchMedia("(max-width: 639px)").matches ? 0.5 : 0.95;
}
