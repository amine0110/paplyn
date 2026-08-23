import type { EditorView } from "@codemirror/view";
import type { AiClientAction } from "@/lib/ai-client-actions";

/** Action types that mutate workspace source when successfully applied. */
const WORKSPACE_MUTATING_ACTION_TYPES = new Set<AiClientAction["type"]>([
  "replace_lines",
  "apply_edit",
  "insert_at_cursor",
  "replace_selection",
  "fix_compile_errors",
]);

export function isWorkspaceMutatingAction(action: AiClientAction): boolean {
  return WORKSPACE_MUTATING_ACTION_TYPES.has(action.type);
}

export function getFilesTouchedByAppliedActions(
  applied: AiClientAction[],
  activeFile: string | null
): string[] {
  const files = new Set<string>();

  for (const action of applied) {
    if (!isWorkspaceMutatingAction(action)) continue;

    switch (action.type) {
      case "apply_edit":
      case "replace_lines":
        files.add(action.file);
        break;
      case "fix_compile_errors":
        for (const edit of action.edits) {
          files.add(edit.file);
        }
        break;
      case "insert_at_cursor":
      case "replace_selection":
        if (activeFile) files.add(activeFile);
        break;
      default:
        break;
    }
  }

  return [...files];
}

export function shouldAutoCompileAfterAiApply(options: {
  isCompileFixTurn: boolean;
  applied: AiClientAction[];
}): boolean {
  if (!options.isCompileFixTurn) return false;
  return options.applied.some(isWorkspaceMutatingAction);
}

/**
 * Yield until CodeMirror/Yjs have applied the dispatched edit.
 * apply-ai-client-actions dispatches synchronously; one frame lets yCollab settle.
 */
export function waitForAppliedEditorContent(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 0);
    });
  });
}

export interface FlushAppliedFilesContext {
  activeFile: string | null;
  editorView: EditorView | null;
  saveFile: (path: string, content: string) => Promise<void>;
  clearPendingEditorSave?: () => void;
}

/** Persist editor buffer for files touched on the active tab (non-active files are saved during apply). */
export async function flushAppliedFilesToProject(
  touchedFiles: string[],
  ctx: FlushAppliedFilesContext
): Promise<void> {
  if (!ctx.activeFile || !touchedFiles.includes(ctx.activeFile)) return;

  ctx.clearPendingEditorSave?.();

  const view = ctx.editorView;
  if (!view) return;

  const content = view.state.doc.toString();
  await ctx.saveFile(ctx.activeFile, content);
}

export interface CompileScheduler {
  schedule: () => void;
  isRunning: () => boolean;
  hasQueued: () => boolean;
}

/** Run compile once; if already running, queue a single follow-up run. */
export function createCompileScheduler(runCompile: () => Promise<void>): CompileScheduler {
  let running = false;
  let queued = false;

  const schedule = () => {
    if (running) {
      queued = true;
      return;
    }

    running = true;
    void runCompile()
      .catch(() => {
        // compile() reports errors in UI; avoid unhandled rejection.
      })
      .finally(() => {
        running = false;
        if (queued) {
          queued = false;
          schedule();
        }
      });
  };

  return {
    schedule,
    isRunning: () => running,
    hasQueued: () => queued,
  };
}

export async function scheduleCompileAfterAppliedActions(options: {
  isCompileFixTurn: boolean;
  applied: AiClientAction[];
  activeFile: string | null;
  flushContext: FlushAppliedFilesContext;
  compileScheduler: CompileScheduler;
}): Promise<void> {
  if (!shouldAutoCompileAfterAiApply(options)) return;

  await waitForAppliedEditorContent();

  const touchedFiles = getFilesTouchedByAppliedActions(options.applied, options.activeFile);
  await flushAppliedFilesToProject(touchedFiles, options.flushContext);

  options.compileScheduler.schedule();
}
