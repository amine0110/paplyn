import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GITHUB_REPO_URL } from "@/lib/product";

type SelfHostCtaProps = {
  size?: "default" | "sm" | "lg";
  variant?: "hero" | "nav" | "docs";
};

export function SelfHostCta({ size = "lg", variant = "hero" }: SelfHostCtaProps) {
  const githubLink =
    variant === "docs"
      ? (
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-light cursor-pointer"
        >
          Self-host on GitHub
        </a>
      )
      : (
        <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
          <Button size={size}>Self-host on GitHub</Button>
        </a>
      );

  const docsLink =
    variant === "docs"
      ? (
        <Link
          href="/docs/configuration"
          className="hidden sm:inline text-sm px-2 py-1.5 text-ink-muted hover:text-navy transition-colors cursor-pointer"
        >
          Configuration guide
        </Link>
      )
      : (
        <Link href="/docs/configuration">
          <Button variant="outline" size={size}>Configuration guide</Button>
        </Link>
      );

  return (
    <div className={variant === "hero" ? "flex gap-4 justify-center" : "flex items-center gap-2"}>
      {githubLink}
      {docsLink}
    </div>
  );
}
