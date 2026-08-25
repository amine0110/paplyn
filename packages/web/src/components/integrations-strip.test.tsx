import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntegrationsStrip } from "@/components/integrations-strip";
import type { LandingIntegration } from "@/lib/integrations/types";

const SAMPLE_ITEMS: LandingIntegration[] = [
  {
    id: "latex",
    name: "LaTeX",
    category: "core",
    href: "https://www.latex-project.org/",
    wordmark: "LaTeX",
    caption: "Built-in editor & compile",
  },
  {
    id: "ollama",
    name: "Ollama",
    category: "ai",
    href: "https://ollama.com",
    wordmark: "Ollama",
    caption: "OpenAI-compatible API",
  },
  {
    id: "cite-doi",
    name: "Crossref",
    category: "plugin",
    href: "https://www.crossref.org/",
    wordmark: "Crossref",
    caption: "DOI → BibTeX",
  },
];

describe("IntegrationsStrip", () => {
  it("renders official logo marks with accessible names instead of visible wordmarks", () => {
    render(<IntegrationsStrip items={SAMPLE_ITEMS} />);

    expect(screen.getAllByLabelText("LaTeX").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText("Ollama").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText("Crossref").length).toBeGreaterThanOrEqual(1);

    expect(screen.queryByText("LaTeX", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ollama", { selector: "span" })).not.toBeInTheDocument();
    expect(screen.queryByText("Crossref", { selector: "span" })).not.toBeInTheDocument();

    const svgs = document.querySelectorAll(".integrations-marquee-track svg");
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });

  it("duplicates items for seamless marquee looping", () => {
    render(<IntegrationsStrip items={SAMPLE_ITEMS} />);
    const trackItems = document.querySelectorAll(".integrations-marquee-track > li");
    expect(trackItems.length).toBe(SAMPLE_ITEMS.length * 2);
  });
});
