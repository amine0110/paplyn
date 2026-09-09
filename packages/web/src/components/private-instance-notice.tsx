import Link from "next/link";
import { GITHUB_REPO_URL, PRODUCT } from "@/lib/product";

export function PrivateInstanceNotice() {
  return (
    <p className="text-sm text-ink-muted text-center">
      {PRODUCT.privateInstanceMessage}{" "}
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-navy hover:underline"
      >
        View on GitHub
      </a>
      {" · "}
      <Link href="/docs/configuration" className="text-navy hover:underline">
        Self-hosting guide
      </Link>
    </p>
  );
}
