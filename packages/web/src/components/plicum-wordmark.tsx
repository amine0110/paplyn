import Image from "next/image";
import { cn } from "@/components/ui/cn";
import { PRODUCT_NAME } from "@/lib/product";

/** Public paths for brand assets (see packages/web/public/brand/). */
export const BRAND = {
  /** Square folded-P mark — header, favicon, and app icon. */
  mark: "/brand/paplyn-mark.png",
  markDark: "/brand/paplyn-mark-dark.png",
  /** Wide wordmark cards — OG / social preview only, not for in-app chrome. */
  wordmarkLight: "/brand/paplyn-wordmark-light.png",
  wordmarkDark: "/brand/paplyn-wordmark-dark.png",
  ogImage: "/brand/paplyn-wordmark-light.png",
  /** @deprecated Use BRAND.mark */
  iconFoldedP: "/brand/paplyn-mark.png",
  /** @deprecated Use BRAND.markDark */
  iconMarkDark: "/brand/paplyn-mark-dark.png",
  favicon: "/brand/favicon.ico",
  appleTouchIcon: "/brand/apple-touch-icon.png",
} as const;

/** Tight-cropped folded-P mark raster size for next/image (paplyn-mark.png). */
const MARK_WIDTH = 410;
const MARK_HEIGHT = 753;

type PlicumWordmarkProps = {
  /** Tailwind height class for the mark (text scales alongside). */
  className?: string;
  priority?: boolean;
  /** When true, always show mark + name (e.g. marketing). Default: responsive chrome. */
  showName?: boolean;
};

/**
 * Header lockup: folded-P mark at natural aspect plus product name as text.
 * Does not use the wide wordmark PNG cards in chrome.
 *
 * Below `sm`, only the mark is shown so the name never clips mid-word on narrow
 * viewports. From `sm` up, mark + full product name are always shown together.
 */
export function PlicumWordmark({ className, priority, showName = false }: PlicumWordmarkProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5 shrink-0 min-w-0", className)}
      aria-label={PRODUCT_NAME}
    >
      <Image
        src={BRAND.mark}
        alt=""
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
        priority={priority}
        className="h-full w-auto shrink-0 object-left"
        aria-hidden
      />
      <span
        className={cn(
          "font-serif text-[1.125em] font-semibold leading-none tracking-tight text-navy whitespace-nowrap shrink-0",
          !showName && "hidden sm:inline"
        )}
      >
        {PRODUCT_NAME}
      </span>
    </span>
  );
}
