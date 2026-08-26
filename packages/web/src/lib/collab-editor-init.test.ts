import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getCollabEditorAuthoritativeContent,
  getCollabEditorInitialDoc,
  shouldDeferCollabBinding,
} from "./collab-seed";

const ROOT = join(import.meta.dirname, "..");
const SAMPLE =
  "\\documentclass{article}\n\\begin{document}\nHello\\end{document}\n";

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("collab editor init (deploy gate)", () => {
  it("shows HTTP initialContent while collab is unsynced and Y.Text is empty", () => {
    expect(shouldDeferCollabBinding(true, false, 0, SAMPLE.length)).toBe(true);
    expect(getCollabEditorInitialDoc("", SAMPLE, false)).toBe(SAMPLE);
    expect(getCollabEditorAuthoritativeContent("", SAMPLE, false)).toBe(SAMPLE);
    expect(getCollabEditorInitialDoc("", SAMPLE, false).length).toBeGreaterThan(0);
  });

  it("uses Y.Text after sync even when initialContent differs", () => {
    expect(shouldDeferCollabBinding(true, true, 0, SAMPLE.length)).toBe(false);
    expect(getCollabEditorInitialDoc("live", SAMPLE, true)).toBe("live");
    expect(getCollabEditorAuthoritativeContent("live", SAMPLE, true)).toBe("live");
  });

  it("does not defer when HTTP snapshot is empty", () => {
    expect(shouldDeferCollabBinding(true, false, 0, 0)).toBe(false);
    expect(getCollabEditorInitialDoc("", "", false)).toBe("");
  });

  it("does not defer when Y.Text already has content before sync completes", () => {
    expect(shouldDeferCollabBinding(true, false, SAMPLE.length, SAMPLE.length)).toBe(false);
    expect(getCollabEditorInitialDoc(SAMPLE, SAMPLE, false)).toBe(SAMPLE);
  });

  it("latex-editor defers yCollab and shows stored file before websocket sync", () => {
    const src = readSource("components/latex-editor.tsx");
    expect(src).toContain("shouldDeferCollabBinding");
    expect(src).toContain("collabSyncCompartment");
    expect(src).toContain("getCollabEditorInitialDoc");
    expect(src).toContain("getCollabEditorAuthoritativeContent");
    expect(src).toContain("deferCollabBinding()");
    expect(src).not.toMatch(
      /getCollabEditorInitialDoc\(\s*ytext\.toString\(\)\s*\)/
    );
    expect(src).toMatch(/editableCompartment\.of\(EditorView\.editable\.of\(canEdit && collabSynced\)/);
    expect(src).toMatch(/buildCollabEditorSyncExtensions\(true, ytext, provider\.awareness\)/);
  });

  it("stats and save paths ignore unsynced empty Y.Text when HTTP content exists", () => {
    const src = readSource("components/latex-editor.tsx");
    expect(src).toContain("if (deferCollabBinding())");
    expect(src).toMatch(/reportStats\(preview\)/);
    expect(src).not.toMatch(/reportStats\(\s*""\s*\)/);
  });
});
