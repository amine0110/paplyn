import type { MouseEvent } from "react";
import { isInternalAppPath } from "@/lib/internal-path";

/** Full page navigation that App Router client transitions cannot cancel. */
export function hardNavigate(path: string): void {
  if (!isInternalAppPath(path)) return;
  window.location.assign(path);
}

function isPlainPrimaryClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

/**
 * Use on a Next `<Link>` (or `<a>`) so primary left-clicks hard-navigate while
 * middle-click, modifier-click, and open-in-new-tab keep native behavior.
 */
export function handleHardNavClick(
  event: MouseEvent<HTMLAnchorElement>,
  path: string,
): void {
  if (!isPlainPrimaryClick(event)) return;
  event.preventDefault();
  hardNavigate(path);
}
