/**
 * Stable class-name constants for app chrome interactive affordances.
 * Defined in globals.css @layer components — keep in sync when editing styles.
 */
export const FOCUS_RING = "focus-ring";

export const CHROME_HOVER = "chrome-hover";

export const CHROME_ICON_BTN = "chrome-icon-btn";

export const CHROME_ICON_BTN_SM = "chrome-icon-btn-sm";

export const CHROME_ICON_BTN_MD = "chrome-icon-btn-md";

export const CHROME_CHIP = "chrome-chip";

export const CHROME_TOOLBAR_BTN = "chrome-toolbar-btn";

export const CHROME_SEND_BTN = "chrome-send-btn";

export const CHROME_MENU_ITEM = "chrome-menu-item";

export const CHROME_SEGMENT = "chrome-segment";

export const CHROME_SEGMENT_INACTIVE = "chrome-segment-inactive";

export const CHROME_SEGMENT_ACTIVE = "chrome-segment-active";

export const CHROME_TAB_INACTIVE = "chrome-tab-inactive";

export const CHROME_DESTRUCTIVE_ICON = "chrome-destructive-icon";

export const CHROME_LINK = "chrome-link";

/** Right chrome cluster: theme toggle + text links (landing Nav, docs header). */
export const CHROME_NAV_CLUSTER = "flex items-center gap-2 sm:gap-3 md:gap-6";

export const CHROME_NAV_CLUSTER_MIN = `${CHROME_NAV_CLUSTER} shrink min-w-0`;

export const CHROME_NAV_CLUSTER_SHRINK_0 = `${CHROME_NAV_CLUSTER} shrink-0`;

/** Horizontal inset on top-bar text links for hit target and breathing room. */
export const CHROME_NAV_LINK_PAD = "px-1.5";

/** Extra space between theme toggle and the first text link on md+ breakpoints. */
export const CHROME_NAV_THEME_SEP = "md:mr-2";
