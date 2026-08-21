import { describe, it, expect } from "vitest";
import {
  DEFAULT_MAX_REVISIONS,
  buildRestorePlan,
  buildRevisionLabel,
  buildRevisionSnapshot,
  parseRevisionSnapshot,
  revisionIdsToPrune,
  toRevisionListItem,
} from "@/lib/project-revisions";

describe("project revision helpers", () => {
  it("builds revision labels", () => {
    expect(buildRevisionLabel("compile")).toBe("Successful compile");
    expect(buildRevisionLabel("manual")).toBe("Manual snapshot");
    expect(buildRevisionLabel("manual", "  Before refactor  ")).toBe("Before refactor");
  });

  it("builds a snapshot from project files and optional pdf", () => {
    const snapshot = buildRevisionSnapshot(
      { mainFile: "main.tex", compiler: "xelatex" },
      [
        { path: "main.tex", content: "\\documentclass{article}", isBinary: false },
        { path: "refs.bib", content: "", isBinary: false },
      ],
      "base64-pdf"
    );

    expect(snapshot).toEqual({
      mainFile: "main.tex",
      compiler: "xelatex",
      files: [
        { path: "main.tex", content: "\\documentclass{article}", isBinary: false },
        { path: "refs.bib", content: "", isBinary: false },
      ],
      pdf: "base64-pdf",
    });
  });

  it("parses valid revision snapshots", () => {
    const snapshot = {
      mainFile: "main.tex",
      compiler: "pdflatex",
      files: [{ path: "main.tex", content: "hello", isBinary: false }],
      pdf: "abc",
    };

    expect(parseRevisionSnapshot(snapshot)).toEqual(snapshot);
    expect(parseRevisionSnapshot({ ...snapshot, files: [{ path: "x" }] })).toBeNull();
  });

  it("returns ids to prune when over the retention limit", () => {
    const ids = ["r1", "r2", "r3", "r4", "r5"];

    expect(revisionIdsToPrune(ids, DEFAULT_MAX_REVISIONS)).toEqual([]);
    expect(revisionIdsToPrune(ids, 3)).toEqual(["r4", "r5"]);
    expect(revisionIdsToPrune(ids, 1)).toEqual(["r2", "r3", "r4", "r5"]);
    expect(revisionIdsToPrune(ids, 0)).toEqual(ids);
  });

  it("builds a restore plan that upserts snapshot files and deletes extras", () => {
    const snapshot = buildRevisionSnapshot(
      { mainFile: "main.tex", compiler: "lualatex" },
      [
        { path: "main.tex", content: "restored", isBinary: false },
        { path: "figures/plot.png", content: "data:image/png;base64,abc", isBinary: true },
      ],
      "pdf-data"
    );

    const plan = buildRestorePlan(snapshot, [
      "main.tex",
      "old.tex",
      "figures/plot.png",
      "unused.bib",
    ]);

    expect(plan.filesToUpsert).toHaveLength(2);
    expect(plan.pathsToDelete).toEqual(["old.tex", "unused.bib"]);
    expect(plan.mainFile).toBe("main.tex");
    expect(plan.compiler).toBe("lualatex");
    expect(plan.pdf).toBe("pdf-data");
  });

  it("maps revision rows to list items without exposing file contents", () => {
    const item = toRevisionListItem({
      id: "rev-1",
      label: null,
      source: "compile",
      createdAt: new Date("2026-08-21T12:00:00.000Z"),
      userId: "user-1",
      mainFile: "main.tex",
      compiler: "pdflatex",
      files: [{ path: "main.tex" }, { path: "refs.bib" }],
      pdf: "abc",
    });

    expect(item).toMatchObject({
      id: "rev-1",
      label: "Successful compile",
      source: "compile",
      userId: "user-1",
      fileCount: 2,
      hasPdf: true,
    });
    expect(item.createdAt).toBe("2026-08-21T12:00:00.000Z");
  });
});
