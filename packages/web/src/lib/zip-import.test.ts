import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { detectMainTexFile } from "@/lib/project-ops";
import {
  encodeZipEntry,
  listSanitizedZipPaths,
  parseProjectZip,
  sanitizeZipEntryPath,
  shouldSkipZipEntry,
  stripCommonRootPrefix,
} from "@/lib/zip-import";

describe("zip import helpers", () => {
  it("sanitizes valid relative paths", () => {
    expect(sanitizeZipEntryPath("main.tex")).toBe("main.tex");
    expect(sanitizeZipEntryPath("figures/chart.png")).toBe("figures/chart.png");
    expect(sanitizeZipEntryPath("project\\sections\\intro.tex")).toBe("project/sections/intro.tex");
  });

  it("rejects zip-slip and absolute paths", () => {
    expect(sanitizeZipEntryPath("../etc/passwd")).toBeNull();
    expect(sanitizeZipEntryPath("figures/../../secret.tex")).toBeNull();
    expect(sanitizeZipEntryPath("/etc/passwd")).toBeNull();
    expect(sanitizeZipEntryPath("C:\\Windows\\system32\\evil.tex")).toBeNull();
    expect(sanitizeZipEntryPath("..")).toBeNull();
  });

  it("rejects directories and empty paths", () => {
    expect(sanitizeZipEntryPath("figures/")).toBeNull();
    expect(sanitizeZipEntryPath("")).toBeNull();
  });

  it("skips macOS metadata paths", () => {
    expect(shouldSkipZipEntry("__MACOSX/._main.tex")).toBe(true);
    expect(shouldSkipZipEntry(".DS_Store")).toBe(true);
    expect(shouldSkipZipEntry("main.tex")).toBe(false);
  });

  it("lists sanitized zip paths and drops unsafe entries", () => {
    expect(
      listSanitizedZipPaths([
        "main.tex",
        "../escape.tex",
        "__MACOSX/._main.tex",
        "figures/plot.png",
        "figures/",
      ])
    ).toEqual(["main.tex", "figures/plot.png"]);
  });

  it("strips a common Overleaf-style root folder", () => {
    const remap = stripCommonRootPrefix([
      "my-paper/main.tex",
      "my-paper/refs.bib",
      "my-paper/figures/chart.png",
    ]);

    expect(remap.get("my-paper/main.tex")).toBe("main.tex");
    expect(remap.get("my-paper/refs.bib")).toBe("refs.bib");
    expect(remap.get("my-paper/figures/chart.png")).toBe("figures/chart.png");
  });

  it("keeps paths when files are not all under one folder", () => {
    const remap = stripCommonRootPrefix(["main.tex", "nested/chapter.tex"]);
    expect(remap.get("main.tex")).toBe("main.tex");
    expect(remap.get("nested/chapter.tex")).toBe("nested/chapter.tex");
  });

  it("detects main.tex before other .tex files", () => {
    expect(detectMainTexFile(["chapters/intro.tex", "main.tex", "appendix.tex"])).toBe("main.tex");
    expect(detectMainTexFile(["chapters/main.tex", "paper.tex"])).toBe("chapters/main.tex");
    expect(detectMainTexFile(["alpha.tex", "beta.tex"])).toBe("alpha.tex");
    expect(detectMainTexFile([])).toBeNull();
  });

  it("encodes binary entries as data URLs with isBinary", () => {
    const entry = encodeZipEntry("figures/chart.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(entry.isBinary).toBe(true);
    expect(entry.content.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("parses an Overleaf-style zip into project files", async () => {
    const zip = new JSZip();
    zip.file("imported/main.tex", "\\documentclass{article}\n\\begin{document}Hi\\end{document}");
    zip.file("imported/refs.bib", "@article{a, title={A}}");
    zip.file("imported/figures/chart.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const parsed = await parseProjectZip(buffer);

    expect(parsed.mainFile).toBe("main.tex");
    expect(parsed.files.map((file) => file.path).sort()).toEqual([
      "figures/chart.png",
      "main.tex",
      "refs.bib",
    ]);

    const image = parsed.files.find((file) => file.path === "figures/chart.png");
    expect(image?.isBinary).toBe(true);
    expect(image?.content.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("falls back to the first .tex file when main.tex is missing", async () => {
    const zip = new JSZip();
    zip.file("paper/sections/intro.tex", "\\documentclass{article}");
    zip.file("paper/sections/appendix.tex", "\\section{Appendix}");

    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const parsed = await parseProjectZip(buffer);

    expect(parsed.mainFile).toBe("sections/appendix.tex");
  });

  it("rejects zips with no .tex files", async () => {
    const zip = new JSZip();
    zip.file("notes/readme.txt", "not latex");

    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    await expect(parseProjectZip(buffer)).rejects.toThrow(/at least one \.tex file/i);
  });
});
