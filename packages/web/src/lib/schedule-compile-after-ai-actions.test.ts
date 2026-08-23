import { describe, expect, it, vi } from "vitest";
import type { AiClientAction } from "@/lib/ai-client-actions";
import {
  createCompileScheduler,
  flushAppliedFilesToProject,
  getFilesTouchedByAppliedActions,
  scheduleCompileAfterAppliedActions,
  shouldAutoCompileAfterAiApply,
  waitForAppliedEditorContent,
} from "@/lib/schedule-compile-after-ai-actions";

describe("shouldAutoCompileAfterAiApply", () => {
  const appliedEdit: AiClientAction = {
    type: "apply_edit",
    file: "main.tex",
    search: "foo",
    replace: "bar",
    label: "edit",
  };

  it("schedules compile for compile-fix turns with applied workspace edits", () => {
    expect(
      shouldAutoCompileAfterAiApply({ isCompileFixTurn: true, applied: [appliedEdit] })
    ).toBe(true);
  });

  it("does not schedule compile when no edit landed", () => {
    expect(shouldAutoCompileAfterAiApply({ isCompileFixTurn: true, applied: [] })).toBe(false);
  });

  it("does not schedule compile for non compile-fix turns", () => {
    expect(
      shouldAutoCompileAfterAiApply({ isCompileFixTurn: false, applied: [appliedEdit] })
    ).toBe(false);
  });
});

describe("getFilesTouchedByAppliedActions", () => {
  it("collects files from replace_lines and fix_compile_errors", () => {
    const applied: AiClientAction[] = [
      {
        type: "replace_lines",
        file: "main.tex",
        startLine: 1,
        endLine: 1,
        replace: "x",
        label: "lines",
      },
      {
        type: "fix_compile_errors",
        label: "fix",
        edits: [{ file: "refs.bib", search: "a", replace: "b" }],
      },
    ];

    expect(getFilesTouchedByAppliedActions(applied, "main.tex").sort()).toEqual([
      "main.tex",
      "refs.bib",
    ]);
  });

  it("maps cursor inserts to the active file", () => {
    const applied: AiClientAction[] = [
      { type: "insert_at_cursor", text: "% fix", label: "insert" },
    ];

    expect(getFilesTouchedByAppliedActions(applied, "chapters/intro.tex")).toEqual([
      "chapters/intro.tex",
    ]);
  });
});

describe("createCompileScheduler", () => {
  it("queues a single follow-up compile while one is running", async () => {
    let resolveFirst: (() => void) | undefined;
    const runCompile = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          if (runCompile.mock.calls.length === 1) {
            resolveFirst = resolve;
          } else {
            resolve();
          }
        })
    );

    const scheduler = createCompileScheduler(runCompile);

    scheduler.schedule();
    scheduler.schedule();
    scheduler.schedule();

    expect(runCompile).toHaveBeenCalledTimes(1);
    expect(scheduler.isRunning()).toBe(true);
    expect(scheduler.hasQueued()).toBe(true);

    resolveFirst?.();
    await vi.waitFor(() => expect(runCompile).toHaveBeenCalledTimes(2));
    expect(scheduler.hasQueued()).toBe(false);
  });

  it("skips starting a second compile when none is queued after finish", async () => {
    const runCompile = vi.fn(async () => undefined);
    const scheduler = createCompileScheduler(runCompile);

    scheduler.schedule();
    await vi.waitFor(() => expect(scheduler.isRunning()).toBe(false));

    expect(runCompile).toHaveBeenCalledTimes(1);
  });
});

describe("flushAppliedFilesToProject", () => {
  it("saves active editor content when the active file was touched", async () => {
    const saveFile = vi.fn(async () => undefined);
    const clearPendingEditorSave = vi.fn();

    await flushAppliedFilesToProject(["main.tex"], {
      activeFile: "main.tex",
      editorView: { state: { doc: { toString: () => "updated source" } } } as never,
      saveFile,
      clearPendingEditorSave,
    });

    expect(clearPendingEditorSave).toHaveBeenCalled();
    expect(saveFile).toHaveBeenCalledWith("main.tex", "updated source");
  });

  it("does nothing when only non-active files were touched", async () => {
    const saveFile = vi.fn(async () => undefined);

    await flushAppliedFilesToProject(["other.tex"], {
      activeFile: "main.tex",
      editorView: { state: { doc: { toString: () => "updated source" } } } as never,
      saveFile,
    });

    expect(saveFile).not.toHaveBeenCalled();
  });
});

describe("scheduleCompileAfterAppliedActions", () => {
  it("waits for editor sync, flushes, and schedules compile for compile-fix applies", async () => {
    const saveFile = vi.fn(async () => undefined);
    const runCompile = vi.fn(async () => undefined);
    const scheduler = createCompileScheduler(runCompile);

    await scheduleCompileAfterAppliedActions({
      isCompileFixTurn: true,
      applied: [
        {
          type: "replace_lines",
          file: "main.tex",
          startLine: 1,
          endLine: 1,
          replace: "fixed",
          label: "lines",
        },
      ],
      activeFile: "main.tex",
      flushContext: {
        activeFile: "main.tex",
        editorView: { state: { doc: { toString: () => "fixed" } } } as never,
        saveFile,
      },
      compileScheduler: scheduler,
    });

    expect(saveFile).toHaveBeenCalledWith("main.tex", "fixed");
    await vi.waitFor(() => expect(runCompile).toHaveBeenCalledTimes(1));
  });

  it("does not schedule compile for no-op compile-fix turns", async () => {
    const runCompile = vi.fn(async () => undefined);
    const scheduler = createCompileScheduler(runCompile);

    await scheduleCompileAfterAppliedActions({
      isCompileFixTurn: true,
      applied: [],
      activeFile: "main.tex",
      flushContext: {
        activeFile: "main.tex",
        editorView: null,
        saveFile: vi.fn(),
      },
      compileScheduler: scheduler,
    });

    expect(runCompile).not.toHaveBeenCalled();
  });
});

describe("waitForAppliedEditorContent", () => {
  it("resolves after yielding to the event loop", async () => {
    await waitForAppliedEditorContent();
  });
});
