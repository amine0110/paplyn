import type { Metadata } from "next";
import { getDocSections } from "@/lib/docs";
import { DocsShell } from "@/components/docs/docs-shell";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `Documentation — ${PRODUCT.name}`,
  description: `Guides and integration help for ${PRODUCT.name}.`,
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const sections = getDocSections();

  return <DocsShell sections={sections}>{children}</DocsShell>;
}
