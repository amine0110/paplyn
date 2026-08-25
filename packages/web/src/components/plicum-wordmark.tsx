import Image from "next/image";
import { cn } from "@/components/ui/cn";
import { PRODUCT_NAME } from "@/lib/product";

/** Public paths for brand assets (see packages/web/public/brand/). */
export const BRAND = {
  wordmarkLight: "/brand/paplyn-wordmark-light.png",
  wordmarkDark: "/brand/paplyn-wordmark-dark.png",
  /** Square folded-P mark — favicon / app icon only, not for headers. */
  iconFoldedP: "/brand/paplyn-mark.png",
  iconMarkDark: "/brand/paplyn-mark-dark.png",
  /** Open Graph / social preview (wordmark on paper). */
  ogImage: "/brand/paplyn-wordmark-light.png",
  favicon: "/brand/favicon.ico",
  appleTouchIcon: "/brand/apple-touch-icon.png",
} as const;

/** Wordmark raster dimensions for next/image (paplyn-wordmark-*.png). */
const WORDMARK_WIDTH = 1536;
const WORDMARK_HEIGHT = 1024;

type PlicumWordmarkProps = {
  /** Tailwind height class — word scales to header height. */
  className?: string;
  priority?: boolean;
};

/**
 * Theme-aware product wordmark. Shows the light mark in light mode and the dark
 * mark in dark mode — never both at once.
 */
export function PlicumWordmark({ className, priority }: PlicumWordmarkProps) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Image
        src={BRAND.wordmarkLight}
        alt={PRODUCT_NAME}
        width={WORDMARK_WIDTH}
        height={WORDMARK_HEIGHT}
        priority={priority}
        className="h-full w-auto dark:hidden"
      />
      <Image
        src={BRAND.wordmarkDark}
        alt={PRODUCT_NAME}
        width={WORDMARK_WIDTH}
        height={WORDMARK_HEIGHT}
        priority={priority}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
