import { describe, it, expect } from "vitest";
import {
  FOLDER_PLACEHOLDER,
  buildFileTree,
  contentToBase64,
  folderPathFromFile,
  folderPlaceholderPath,
  isBinaryAsset,
  isFolderPlaceholder,
  isImageFile,
  isPdfFile,
  isTextSourceFile,
  joinPath,
  mimeTypeForPath,
  normalizePath,
  PDF_DOWNLOAD_MIME,
  pdfDownloadHref,
  projectPdfFilename,
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
});
