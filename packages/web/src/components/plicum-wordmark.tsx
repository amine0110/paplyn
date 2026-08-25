import Image from "next/image";
import { cn } from "@/components/ui/cn";
import { PRODUCT_NAME } from "@/lib/product";

/** Public paths for brand assets (see packages/web/public/brand/). */
export const BRAND = {
  wordmarkLight: "/brand/plicum-wordmark-light.png",
  wordmarkDark: "/brand/plicum-wordmark-dark.png",
  /** Square folded-P mark — favicon / app icon only, not for headers. */
  iconFoldedP: "/brand/plicum-icon-folded-p.png",
  favicon: "/brand/favicon.ico",
  appleTouchIcon: "/brand/apple-touch-icon.png",
} as const;

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
        width={789}
        height={225}
        priority={priority}
        className="h-full w-auto dark:hidden"
      />
      <Image
        src={BRAND.wordmarkDark}
        alt={PRODUCT_NAME}
        width={970}
        height={264}
        priority={priority}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
