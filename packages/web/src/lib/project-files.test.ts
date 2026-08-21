import { describe, it, expect } from "vitest";
import {
  FOLDER_PLACEHOLDER,
  buildFileTree,
  buildRenameMap,
  contentToBase64,
  decodeBinaryContent,
  folderPathFromFile,
  folderPlaceholderPath,
  isBinaryAsset,
  isFolderPlaceholder,
  isImageFile,
  isPdfFile,
  isTextSourceFile,
  isUnderPrefix,
  joinPath,
  listZipEntries,
  mimeTypeForPath,
  normalizePath,
  pathsUnderPrefix,
  PDF_DOWNLOAD_MIME,
  pdfDownloadHref,
  projectPdfFilename,
  projectZipFilename,
  resolveMainFileAfterRename,
  rewritePathPrefix,
} from "@/lib/project-files";

describe("project file helpers", () => {
  it("detects text, image, and pdf files by extension", () => {
    expect(isTextSourceFile("main.tex")).toBe(true);
    expect(isTextSourceFile("refs.bib")).toBe(true);
    expect(isTextSourceFile("style.cls")).toBe(true);
    expect(isTextSourceFile("package.sty")).toBe(true);
    expect(isTextSourceFile("figure.png")).toBe(false);

    expect(isImageFile("figures/plot.png")).toBe(true);
    expect(isImageFile("photo.JPG")).toBe(true);
    expect(isImageFile("notes.tex")).toBe(false);

    expect(isPdfFile("paper.pdf")).toBe(true);
    expect(isBinaryAsset("paper.pdf")).toBe(true);
    expect(isBinaryAsset("plot.jpeg")).toBe(true);
  });

  it("normalizes and joins paths", () => {
    expect(normalizePath("/figures//chart.png")).toBe("figures/chart.png");
    expect(joinPath("figures", "chart.png")).toBe("figures/chart.png");
    expect(joinPath("", "main.tex")).toBe("main.tex");
    expect(folderPathFromFile("figures/chart.png")).toBe("figures");
    expect(folderPathFromFile("main.tex")).toBe("");
  });

  it("recognizes folder placeholder paths", () => {
    expect(isFolderPlaceholder("figures/.keep")).toBe(true);
    expect(isFolderPlaceholder("main.tex")).toBe(false);
    expect(folderPlaceholderPath("figures")).toBe(`figures/${FOLDER_PLACEHOLDER}`);
  });

  it("builds a nested tree and keeps empty folders via placeholders", () => {
    const tree = buildFileTree([
      "main.tex",
      "figures/chart.png",
      "figures/.keep",
      "assets/.keep",
    ]);

    expect(tree.map((n) => n.name)).toEqual(["assets", "figures", "main.tex"]);

    const figures = tree.find((n) => n.name === "figures");
    expect(figures?.isFile).toBe(false);
    expect(figures?.children.map((n) => n.name)).toEqual(["chart.png"]);

    const assets = tree.find((n) => n.name === "assets");
    expect(assets?.isFile).toBe(false);
    expect(assets?.children).toEqual([]);
  });

  it("extracts base64 payload from data URLs", () => {
    expect(contentToBase64("data:image/png;base64,abc123")).toBe("abc123");
    expect(contentToBase64("plain-base64")).toBe("plain-base64");
  });

  it("maps mime types for common asset paths", () => {
    expect(mimeTypeForPath("plot.png")).toBe("image/png");
    expect(mimeTypeForPath("photo.jpeg")).toBe("image/jpeg");
    expect(mimeTypeForPath("draft.pdf")).toBe("application/pdf");
  });

  it("builds a sanitized project PDF filename", () => {
    expect(projectPdfFilename("My Thesis!")).toBe("My-Thesis.pdf");
    expect(projectPdfFilename("already.pdf")).toBe("already.pdf");
  });

  it("uses application/pdf for download hrefs", () => {
    expect(pdfDownloadHref("abc")).toBe(`data:${PDF_DOWNLOAD_MIME};base64,abc`);
  });

  it("finds paths under a folder prefix", () => {
    const paths = ["main.tex", "figures/chart.png", "figures/.keep", "refs.bib"];
    expect(pathsUnderPrefix(paths, "figures")).toEqual(["figures/chart.png", "figures/.keep"]);
    expect(isUnderPrefix("figures/chart.png", "figures")).toBe(true);
    expect(isUnderPrefix("main.tex", "figures")).toBe(false);
  });

  it("rewrites path prefixes for folder rename", () => {
    expect(rewritePathPrefix("figures/chart.png", "figures", "assets")).toBe("assets/chart.png");
    expect(rewritePathPrefix("figures/.keep", "figures", "assets")).toBe("assets/.keep");
    expect(rewritePathPrefix("figures", "figures", "assets")).toBe("assets");
  });

  it("builds rename maps for files and folders", () => {
    const paths = ["main.tex", "figures/chart.png", "figures/.keep", "refs.bib"];

    const fileMove = buildRenameMap(paths, "refs.bib", "figures/refs.bib");
    expect(fileMove.ok).toBe(true);
    if (fileMove.ok) {
      expect(Array.from(fileMove.map.entries())).toEqual([["refs.bib", "figures/refs.bib"]]);
    }

    const fileRename = buildRenameMap(paths, "main.tex", "article.tex");
    expect(fileRename.ok).toBe(true);
    if (fileRename.ok) {
      expect(fileRename.map.get("main.tex")).toBe("article.tex");
    }

    const folderRename = buildRenameMap(paths, "figures", "images");
    expect(folderRename.ok).toBe(true);
    if (folderRename.ok) {
      expect(folderRename.map.get("figures/chart.png")).toBe("images/chart.png");
      expect(folderRename.map.get("figures/.keep")).toBe("images/.keep");
    }

    const collision = buildRenameMap(paths, "main.tex", "refs.bib");
    expect(collision.ok).toBe(false);

    const intoDescendant = buildRenameMap(paths, "figures", "figures/nested");
    expect(intoDescendant.ok).toBe(false);
  });

  it("updates mainFile when renamed paths match", () => {
    const map = new Map([
      ["main.tex", "article.tex"],
      ["figures/chart.png", "images/chart.png"],
      ["figures/.keep", "images/.keep"],
    ]);

    expect(resolveMainFileAfterRename("main.tex", map)).toBe("article.tex");
    expect(resolveMainFileAfterRename("figures/chart.png", map)).toBe("images/chart.png");
    expect(resolveMainFileAfterRename("refs.bib", map)).toBe("refs.bib");
  });

  it("lists zip entries excluding placeholders and decoding binaries", () => {
    const entries = listZipEntries([
      { path: "main.tex", content: "\\documentclass{article}" },
      { path: "figures/.keep", content: "" },
      {
        path: "figures/chart.png",
        content: "data:image/png;base64,YWJj",
        isBinary: true,
      },
    ]);

    expect(entries.map((entry) => entry.path)).toEqual(["main.tex", "figures/chart.png"]);
    expect(entries[0]?.content).toBe("\\documentclass{article}");
    expect(entries[1]?.isBinary).toBe(true);
    expect(decodeBinaryContent("data:image/png;base64,YWJj")).toEqual(new Uint8Array([97, 98, 99]));
  });

  it("builds a sanitized project zip filename", () => {
    expect(projectZipFilename("My Thesis!")).toBe("My-Thesis.zip");
    expect(projectZipFilename("already.zip")).toBe("already.zip");
  });
});
