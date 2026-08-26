/** Paths used for hard (full-page) navigation out of heavy client views. */
export const DASHBOARD_PATH = "/dashboard";

/** Hard navigation so App Router client transitions cannot be swallowed. */
export function leaveForDashboard(): void {
  window.location.assign(DASHBOARD_PATH);
}

export type HardNavClickEvent = Pick<
  MouseEvent,
  "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
> & {
  preventDefault: () => void;
};

/** True when the user expects a new tab/window or non-primary click. */
export function isModifiedNavigationClick(event: HardNavClickEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

/** Left-click hard navigation; preserve href for middle-click and modifier opens. */
export function handleHardNavClick(event: HardNavClickEvent, href: string): void {
  if (isModifiedNavigationClick(event)) return;
  event.preventDefault();
  window.location.assign(href);
}

export function handleDashboardBackClick(event: HardNavClickEvent): void {
  handleHardNavClick(event, DASHBOARD_PATH);
}
