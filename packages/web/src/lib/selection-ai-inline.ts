import type { EditorView } from "@codemirror/view";
import { aiUnavailableBannerMessage, isClientSelfHosted } from "@/lib/ai-config";
import { extractInsertableContent } from "@/lib/ai-insert-content";
import { loadingLabelForAction } from "@/lib/ai-plugins/client-meta";
import type { AiClientAction } from "@/lib/ai-client-actions";
import type { AiPaper } from "@/lib/ai-types";
import { consumeAiStream } from "@/lib/ai-stream";
import {
  applyAiClientActions,
  normalizeInsertAtCursorText,
  type ApplyAiActionsContext,
} from "@/lib/apply-ai-client-actions";

export interface SelectionRange {
  from: number;
  to: number;
}

export interface InlineSelectionAiRequest {
  projectId: string;
  activeFile: string | null;
  message: string;
  action?: string;
  selectedText: string;
  selectionRange: SelectionRange;
}

export interface InlineSelectionAiContext {
  applyActionsContext: Omit<ApplyAiActionsContext, "hasSelection" | "selectionRange">;
}

export interface InlineSelectionAiResult {
  ok: boolean;
  statusMessage: string;
  papers?: AiPaper[];
  error?: string;
}

function dispatchEditorChange(
  view: EditorView,
  from: number,
  to: number,
  insert: string
): void {
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
}

function applyTextAtSelection(
  view: EditorView,
  selectionRange: SelectionRange,
  text: string,
  hasSelection: boolean
): void {
  const { from, to } = selectionRange;
  const doc = view.state.doc.toString();
  const normalized = hasSelection
    ? text
    : normalizeInsertAtCursorText(text, doc, from);
  dispatchEditorChange(view, from, to, normalized);
}

function isEditorSelectionAction(action: AiClientAction): boolean {
  return action.type === "insert_at_cursor" || action.type === "replace_selection";
}

async function applyInlineActions(
  actions: AiClientAction[],
  ctx: ApplyAiActionsContext,
  selectionRange: SelectionRange,
  hasSelection: boolean
): Promise<boolean> {
  const editorActions = actions.filter(isEditorSelectionAction);
  const fileActions = actions.filter((action) => !isEditorSelectionAction(action));

  let appliedEditor = false;

  if (editorActions.length > 0) {
    const view = ctx.editorView;
    if (!view) return false;

    for (const action of editorActions) {
      const text =
        action.type === "insert_at_cursor" || action.type === "replace_selection"
          ? action.text
          : "";
      if (!text) continue;
      applyTextAtSelection(view, selectionRange, text, hasSelection);
      appliedEditor = true;
    }
  }

  if (fileActions.length > 0) {
    const result = await applyAiClientActions(fileActions, ctx);
    if (result.applied.length > 0) appliedEditor = true;
  }

  return appliedEditor;
}

export async function runInlineSelectionAi(
  request: InlineSelectionAiRequest,
  ctx: InlineSelectionAiContext,
  onProgress?: (message: string) => void
): Promise<InlineSelectionAiResult> {
  const hasSelection = Boolean(request.selectedText.trim());
  const applyCtx: ApplyAiActionsContext = {
    ...ctx.applyActionsContext,
    hasSelection,
    selectionRange: request.selectionRange,
  };

  const userMessage = request.message.trim();
  const userMsg = { role: "user" as const, content: userMessage || request.action || "" };

  try {
    const res = await fetch(`/api/projects/${request.projectId}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [userMsg],
        activeFile: request.activeFile,
        cursorLine: ctx.applyActionsContext.editorView
          ? ctx.applyActionsContext.editorView.state.doc.lineAt(request.selectionRange.from).number
          : undefined,
        selectedText: hasSelection ? request.selectedText : undefined,
        action: request.action,
        inlineSelection: hasSelection,
      }),
    });

    if (res.status === 503) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        statusMessage: "AI unavailable",
        error:
          typeof err.error === "string"
            ? err.error
            : aiUnavailableBannerMessage(isClientSelfHosted()),
      };
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const fallback =
        res.status === 413 || res.status === 429
          ? "Prompt too large — try a smaller selection."
          : "Request failed";
      const message =
        typeof err.error === "string"
          ? err.error
          : typeof err.error === "object" && err.error !== null
            ? JSON.stringify(err.error)
            : fallback;
      return { ok: false, statusMessage: "Error", error: message };
    }

    const data = await consumeAiStream(res, (message) => {
      onProgress?.(message);
    });

    const assistantContent = typeof data.content === "string" ? data.content.trim() : "";
    const actions = Array.isArray(data.actions) ? (data.actions as AiClientAction[]) : [];
    const papers = Array.isArray(data.papers) ? (data.papers as AiPaper[]) : undefined;

    let applied = false;

    if (actions.length > 0) {
      applied = await applyInlineActions(
        actions,
        applyCtx,
        request.selectionRange,
        hasSelection
      );
    }

    if (!applied && assistantContent) {
      const view = ctx.applyActionsContext.editorView;
      if (view && !isAiAssistantErrorContent(assistantContent)) {
        const extracted = extractInsertableContent(assistantContent).trim();
        const text = extracted || assistantContent.trim();
        if (text) {
          applyTextAtSelection(view, request.selectionRange, text, hasSelection);
          applied = true;
        }
      }
    }

    if (!applied && !assistantContent && papers?.length) {
      return {
        ok: true,
        statusMessage: `Found ${papers.length} paper${papers.length === 1 ? "" : "s"}`,
        papers,
      };
    }

    if (!applied && !assistantContent) {
      return {
        ok: false,
        statusMessage: "Error",
        error: "The assistant returned an empty response.",
      };
    }

    if (papers?.length) {
      return {
        ok: true,
        statusMessage: applied ? "Done" : `Found ${papers.length} papers`,
        papers,
      };
    }

    return { ok: true, statusMessage: "Done" };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to connect to AI service.";
    return { ok: false, statusMessage: "Error", error: message };
  }
}

export function initialInlineStatusForAction(action?: string, message?: string): string {
  return loadingLabelForAction(action, message).replace(/…$/, "");
}

const INLINE_AI_ERROR_PATTERNS: RegExp[] = [
  /^The project context is too large/i,
  /^The prompt is too large/i,
  /^Please compile your project first/i,
  /^AI service rate limit/i,
  /^Failed to connect to AI service/i,
  /^Request failed$/i,
  /^The assistant returned an empty response/i,
];

function isAiAssistantErrorContent(content: string): boolean {
  const trimmed = content.trim();
  return INLINE_AI_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}
