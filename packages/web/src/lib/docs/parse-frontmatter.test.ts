import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "@/lib/docs/parse-frontmatter";

describe("parseFrontmatter", () => {
  it("parses YAML frontmatter and body", () => {
    const raw = `---
title: Connect Zotero
description: Zotero setup guide
section: Integrations
order: 1
slug: zotero
---

First paragraph.`;

    const { meta, body } = parseFrontmatter(raw);
    expect(meta.title).toBe("Connect Zotero");
    expect(meta.description).toBe("Zotero setup guide");
    expect(meta.section).toBe("Integrations");
    expect(meta.order).toBe(1);
    expect(meta.slug).toBe("zotero");
    expect(body).toBe("First paragraph.");
  });

  it("returns the full string as body when frontmatter is missing", () => {
    const { meta, body } = parseFrontmatter("No frontmatter here.");
    expect(meta).toEqual({});
    expect(body).toBe("No frontmatter here.");
  });
});
