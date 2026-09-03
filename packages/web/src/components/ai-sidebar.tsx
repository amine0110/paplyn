"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, X, Mic, MicOff, Square } from "lucide-react";
import { aiUnavailableBannerMessage, isClientSelfHosted } from "@/lib/ai-config";
import { extractInsertableContent, hasInsertableContent } from "@/lib/ai-insert-content";
import { classifyCompileDiagnosticsReviewFallback } from "@/lib/ai-compile-diagnostics-intent";
import { resolveCompileRouting } from "@/lib/ai-compile-fix-intent";
import type { AiCompileError } from "@/lib/ai-compile-fix-context";
import { hasCompileDiagnosticsPayload } from "@/lib/ai-compile-fix-context";
import { AiMarkdown } from "@/components/ai-markdown";
import { DetectedErrorReportFooter } from "@/components/detected-error-report-footer";
import type { AiAppliedAction, AiClientAction, AiPaper, AiToolRead, AiUsedPlugin, ArxivPaperResult, DoiCitationPayload, ZoteroItemResult } from "@/lib/ai-types";
import { AiComposerToolChip, AiComposerToolPicker, getComposerToolMeta } from "@/components/ai-composer-tool-picker";
import { loadingLabelForAction, type AiPluginClientMeta } from "@/lib/ai-plugins/client-meta";
import { applyAiClientActions, type ApplyAiActionsContext } from "@/lib/apply-ai-client-actions";
import { consumeAiStream } from "@/lib/ai-stream";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { parseVoiceCommand, speechStatusMessage } from "@/lib/voice-commands";
import {
  CHROME_CHIP,
  CHROME_ICON_BTN_MD,
  CHROME_SEND_BTN,
  CHROME_STOP_BTN,
} from "@/lib/chrome-interactive";
import { resolveComposerForcedTool } from "@/lib/ai-composer-forced-tool";
import { reportDetectedError } from "@/lib/report-detected-error";
import { cn } from "@/components/ui/cn";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
  isFailure?: boolean;
  autoReportSent?: boolean;
  usedPlugins?: AiUsedPlugin[];
  papers?: AiPaper[];
  arxivPapers?: ArxivPaperResult[];
  zoteroItems?: ZoteroItemResult[];
  appliedActions?: AiAppliedAction[];
  toolReads?: AiToolRead[];
}

export interface AiPendingRequest {
  message: string;
  action?: string;
  /** When true, preserves compile-fix auto-retry session (one automatic retry). */
  autoCompileFixRetry?: boolean;
}

interface AiSidebarProps {
  projectId: string;
  activeFile: string | null;
  selectedText: string;
  compileErrors: AiCompileError[];
  compileLog?: string;
  onInsert: (text: string) => void;
  onReplace?: (text: string) => void;
  onCitePaper?: (paper: AiPaper) => void | Promise<void>;
  onApplyDoiCitation?: (citation: DoiCitationPayload) => void | Promise<void>;
  onCiteArxivPaper?: (paper: ArxivPaperResult) => void | Promise<void>;
  onCiteZoteroItem?: (item: ZoteroItemResult) => void | Promise<void>;
  onClose: () => void;
  /** Context for applying agentic editor actions (collab-safe). */
  applyActionsContext?: Omit<ApplyAiActionsContext, "hasSelection">;
  /** Full-pane sheet on mobile; sidebar panel on desktop. */
  variant?: "sidebar" | "sheet";
  /** Auto-send when opened from Fix with AI or compile-fix retry. */
  pendingRequest?: AiPendingRequest | null;
  onPendingRequestConsumed?: () => void;
  /** Called after compile-fix actions are applied to the workspace (before auto-compile). */
  onCompileFixActionsApplied?: (applied: AiClientAction[]) => void | Promise<void>;
  /** Called when a user-initiated compile-fix turn starts (not automatic retries). */
  onCompileFixSessionStart?: () => void;
  /** Auto-retry returned actions but none were applied (all rejected/skipped). */
  onCompileFixRetryNoOp?: () => void;
  /** Project-scoped thread; keeps chat when the sidebar panel is closed. */
  messages: AiChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<AiChatMessage[]>>;
}

const SCROLL_THRESHOLD_PX = 80;
const TEXTAREA_MAX_HEIGHT_PX = 160;

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "Unknown authors";
  if (authors.length <= 2) return authors.join(", ");
  return `${authors.slice(0, 2).join(", ")} et al.`;
}

function PluginChip({ plugin }: { plugin: AiUsedPlugin }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-border/80 bg-canvas-dark/60 px-2 py-0.5 text-[10px] font-medium text-ink-muted truncate">
      Used {plugin.displayName}
    </span>
  );
}

function AppliedActionChip({ action }: { action: AiAppliedAction }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200 truncate">
      {action.label}
    </span>
  );
}

function ToolReadChip({ read }: { read: AiToolRead }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-border/60 bg-canvas-dark/40 px-2 py-0.5 text-[10px] font-medium text-ink-faint truncate">
      {read.label}
    </span>
  );
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="ai-typing-dot" />
      <span className="ai-typing-dot" />
      <span className="ai-typing-dot" />
    </span>
  );
}

export function AiSidebar({
  projectId,
  activeFile,
  selectedText,
  compileErrors,
  compileLog = "",
  onInsert,
  onReplace,
  onCitePaper,
  onApplyDoiCitation,
  onCiteArxivPaper,
  onCiteZoteroItem,
  onClose,
  applyActionsContext,
  variant = "sidebar",
  pendingRequest,
  onPendingRequestConsumed,
  onCompileFixActionsApplied,
  onCompileFixSessionStart,
  onCompileFixRetryNoOp,
  messages,
  setMessages,
}: AiSidebarProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Thinking…");
  const [hasStreamProgress, setHasStreamProgress] = useState(false);
  const [available, setAvailable] = useState(true);
  const [citingKey, setCitingKey] = useState<string | null>(null);
  const [citingArxivId, setCitingArxivId] = useState<string | null>(null);
  const [citingZoteroKey, setCitingZoteroKey] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [toolInputPlaceholder, setToolInputPlaceholder] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userScrolledUpRef = useRef(false);
  const messagesRef = useRef(messages);
  const inputBeforeVoiceRef = useRef("");
  const selectedToolRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  messagesRef.current = messages;
  selectedToolRef.current = selectedTool;

  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, []);

  const appendVoiceTranscript = useCallback((transcript: string, isFinal: boolean) => {
    if (!transcript.trim()) return;
    setInput((prev) => {
      const base = inputBeforeVoiceRef.current;
      const spacer = base && !base.endsWith(" ") ? " " : "";
      return isFinal ? `${base}${spacer}${transcript.trim()}` : `${base}${spacer}${transcript}`;
    });
  }, []);

  const speech = useSpeechRecognition({
    onTranscript: appendVoiceTranscript,
    onEnd: () => {
      inputBeforeVoiceRef.current = "";
    },
  });

  useEffect(() => {
    const msg = speechStatusMessage(speech.status);
    setVoiceNote(msg);
  }, [speech.status]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > SCROLL_THRESHOLD_PX;
  }, []);

  useEffect(() => {
    if (userScrolledUpRef.current) return;
    scrollToBottom();
  }, [messages, loading, loadingMessage, scrollToBottom]);

  const applyReturnedActions = useCallback(
    async (
      actions: AiClientAction[],
      options?: { isCompileFixTurn?: boolean; autoCompileFixRetry?: boolean }
    ): Promise<AiAppliedAction[]> => {
      if (!applyActionsContext || actions.length === 0) return [];
      const result = await applyAiClientActions(actions, {
        ...applyActionsContext,
        hasSelection: Boolean(selectedText),
        compileFix: options?.isCompileFixTurn,
      });
      if (options?.isCompileFixTurn && result.applied.length > 0) {
        await onCompileFixActionsApplied?.(result.applied);
      }
      if (
        options?.isCompileFixTurn &&
        options?.autoCompileFixRetry &&
        actions.length > 0 &&
        result.applied.length === 0
      ) {
        onCompileFixRetryNoOp?.();
      }
      return result.applied.map((a) => ({
        label: a.label,
        type: a.type,
        file:
          a.type === "apply_edit" || a.type === "replace_lines"
            ? a.file
            : a.type === "fix_compile_errors"
              ? a.edits[0]?.file
              : undefined,
      }));
    },
    [applyActionsContext, onCompileFixActionsApplied, onCompileFixRetryNoOp, selectedText]
  );

  const appendAiFailureMessage = useCallback(async (message: string) => {
    const result = await reportDetectedError({
      kind: "ai",
      message,
      page: `/project/${projectId}`,
    });
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: message,
        isFailure: true,
        autoReportSent: result.sent,
      },
    ]);
  }, [projectId]);

  async function sendMessage(
    content: string,
    action?: string,
    options?: { autoCompileFixRetry?: boolean; forcedTool?: string }
  ) {
    if (!content.trim() && !action) return;

    const forcedTool = resolveComposerForcedTool(
      options?.forcedTool,
      selectedToolRef.current
    );
    setSelectedTool(null);
    setToolInputPlaceholder(null);

    const diagnosticsIntent = classifyCompileDiagnosticsReviewFallback(content, action);
    const { compileFix: fixIntent, diagnosticsReview } = resolveCompileRouting({
      message: content,
      action,
      diagnosticsReview: diagnosticsIntent,
    });
    const effectiveAction = fixIntent ? "explain-errors" : action;
    const hasDiagnostics = hasCompileDiagnosticsPayload({
      errors: compileErrors,
      log: compileLog,
    });

    if (fixIntent && !options?.autoCompileFixRetry) {
      onCompileFixSessionStart?.();
    }

    if ((fixIntent || diagnosticsReview) && !hasDiagnostics) {
      const userMsg: AiChatMessage = { role: "user", content: content || action || "" };
      const compileFirstMessage = diagnosticsReview
        ? "Please compile your project first so I can review the warnings and log."
        : "Please compile your project first so I can see the current errors.";
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: "assistant",
          content: compileFirstMessage,
        },
      ]);
      setInput("");
      return;
    }

    userScrolledUpRef.current = false;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const { signal } = abortController;

    setLoading(true);
    setHasStreamProgress(false);
    setLoadingMessage(loadingLabelForAction(effectiveAction, content, forcedTool));

    const userMsg: AiChatMessage = { role: "user", content: content || action || "" };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await fetch(`/api/projects/${projectId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          messages: [...messagesRef.current, userMsg],
          activeFile,
          selectedText: selectedText || undefined,
          action: effectiveAction,
          forcedTool,
          compileErrors: hasDiagnostics ? compileErrors : undefined,
          compileLog: compileLog.trim() ? compileLog : undefined,
          autoCompileFixRetry: options?.autoCompileFixRetry || undefined,
        }),
      });

      if (res.status === 503) {
        setAvailable(false);
        const err = await res.json().catch(() => ({}));
        await appendAiFailureMessage(
          err.error || aiUnavailableBannerMessage(isClientSelfHosted()),
        );
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const fallback =
          res.status === 413 || res.status === 429
            ? "The prompt is too large for the AI service. Try a smaller selection or ask about one file."
            : "Request failed";
        const message =
          typeof err.error === "string"
            ? err.error
            : typeof err.error === "object" && err.error !== null
              ? JSON.stringify(err.error)
              : fallback;
        await appendAiFailureMessage(message);
        return;
      }

      const data = await consumeAiStream(
        res,
        (message) => {
          setHasStreamProgress(true);
          setLoadingMessage(message);
        },
        signal
      );
      const assistantContent = typeof data.content === "string" ? data.content.trim() : "";
      if (!assistantContent) {
        await appendAiFailureMessage(
          "The assistant returned an empty response. Please try again.",
        );
        return;
      }

      if (data.compileFixStopRetry) {
        onCompileFixRetryNoOp?.();
      }

      const usedPlugins = Array.isArray(data.usedPlugins) ? (data.usedPlugins as AiUsedPlugin[]) : undefined;
      const papers = Array.isArray(data.papers) ? (data.papers as AiPaper[]) : undefined;
      const arxivPapers = Array.isArray(data.arxivPapers)
        ? (data.arxivPapers as ArxivPaperResult[])
        : undefined;
      const zoteroItems = Array.isArray(data.zoteroItems)
        ? (data.zoteroItems as ZoteroItemResult[])
        : undefined;
      const doiCitations = Array.isArray(data.doiCitations)
        ? (data.doiCitations as DoiCitationPayload[])
        : undefined;
      const toolReads = Array.isArray(data.toolReads) ? (data.toolReads as AiToolRead[]) : undefined;
      const actions = Array.isArray(data.actions) ? (data.actions as AiClientAction[]) : [];

      if (doiCitations?.length && onApplyDoiCitation) {
        for (const citation of doiCitations) {
          await onApplyDoiCitation(citation);
        }
      }

      let appliedActions: AiAppliedAction[] | undefined;
      if (actions.length > 0 && applyActionsContext) {
        appliedActions = await applyReturnedActions(actions, {
          isCompileFixTurn: fixIntent,
          autoCompileFixRetry: options?.autoCompileFixRetry,
        });
      } else if (Array.isArray(data.appliedActions) && data.appliedActions.length > 0) {
        appliedActions = data.appliedActions as AiAppliedAction[];
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantContent,
          ...(usedPlugins?.length ? { usedPlugins } : {}),
          ...(papers?.length ? { papers } : {}),
          ...(arxivPapers?.length ? { arxivPapers } : {}),
          ...(zoteroItems?.length ? { zoteroItems } : {}),
          ...(appliedActions?.length ? { appliedActions } : {}),
          ...(toolReads?.length ? { toolReads } : {}),
        },
      ]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Stopped." },
        ]);
        if (fixIntent) {
          onCompileFixRetryNoOp?.();
        }
        return;
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to connect to AI service.";
      await appendAiFailureMessage(message);
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setHasStreamProgress(false);
    }
  }

  async function handleCiteArxiv(paper: ArxivPaperResult) {
    if (!onCiteArxivPaper) return;
    setCitingArxivId(paper.id);
    try {
      await onCiteArxivPaper(paper);
    } finally {
      setCitingArxivId(null);
    }
  }

  async function handleCiteZotero(item: ZoteroItemResult) {
    if (!onCiteZoteroItem) return;
    setCitingZoteroKey(item.itemKey);
    try {
      await onCiteZoteroItem(item);
    } finally {
      setCitingZoteroKey(null);
    }
  }

  function openArxivPaper(paper: ArxivPaperResult) {
    window.open(paper.sourceUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCite(paper: AiPaper) {
    if (!onCitePaper) return;
    const key = paper.doi ?? paper.title;
    setCitingKey(key);
    try {
      await onCitePaper(paper);
    } finally {
      setCitingKey(null);
    }
  }

  function focusComposerInput() {
    textareaRef.current?.focus();
  }

  function handleSelectTool(toolName: string, meta: AiPluginClientMeta) {
    selectedToolRef.current = toolName;
    setSelectedTool(toolName);
    setToolInputPlaceholder(meta.inputPlaceholder ?? null);
  }

  function handleClearTool() {
    selectedToolRef.current = null;
    setSelectedTool(null);
    setToolInputPlaceholder(null);
  }

  function handleStopGeneration() {
    abortControllerRef.current?.abort();
  }

  function submitComposer() {
    void sendMessage(input);
  }

  function handleVoiceToggle() {
    if (!speech.isSupported || speech.status === "denied") return;
    if (speech.isListening) {
      speech.stop();
      const command = parseVoiceCommand(input);
      if (command.message.trim()) {
        void sendMessage(command.message, command.action);
        setInput("");
      }
      return;
    }
    inputBeforeVoiceRef.current = input;
    speech.start();
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) {
        if (speech.isListening) speech.stop();
        submitComposer();
      }
    }
  }

  function handleComposerSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (speech.isListening) speech.stop();
    submitComposer();
  }

  useEffect(() => {
    if (!pendingRequest) return;
    void sendMessage(pendingRequest.message, pendingRequest.action, {
      autoCompileFixRetry: pendingRequest.autoCompileFixRetry,
    });
    onPendingRequestConsumed?.();
    // Only fire when a new pending request is supplied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest]);

  const quickActions = [
    { label: "Fix errors", action: "explain-errors", disabled: compileErrors.length === 0 },
    { label: "Tighten", action: "tighten", disabled: !selectedText },
    { label: "Add citation", action: "citation", disabled: false },
    { label: "Find papers", action: "find-papers", disabled: false },
  ];

  const canReplace = Boolean(selectedText && onReplace);
  const micDisabled = !speech.isSupported || speech.status === "denied" || loading;
  const canSend = Boolean(input.trim()) && !loading;
  const toolsDisabled = loading;
  const selectedToolMeta = selectedTool ? getComposerToolMeta(selectedTool) : undefined;
  const composerPlaceholder = speech.isListening
    ? "Listening…"
    : toolInputPlaceholder ?? "Message the assistant…";

  return (
    <div
      className={`flex flex-col h-full min-h-0 bg-surface ${
        variant === "sidebar" ? "border-l border-border" : ""
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate">Assistant</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(CHROME_ICON_BTN_MD, "shrink-0 rounded-lg")}
          aria-label="Close AI assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!available && (
        <div className="shrink-0 px-3 pb-2 text-xs text-ink-muted">
          {aiUnavailableBannerMessage(isClientSelfHosted())}
        </div>
      )}

      {voiceNote && (
        <div className="shrink-0 px-3 pb-1.5 text-[11px] text-ink-muted">{voiceNote}</div>
      )}

      {selectedText && (
        <div className="shrink-0 mx-3 mb-2 rounded-lg bg-canvas-dark/50 px-2.5 py-1.5 text-xs text-ink-muted">
          <span className="font-medium text-ink">Selection</span>
          <span className="mx-1 text-ink-faint">·</span>
          <span className="line-clamp-2">{selectedText}</span>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={handleMessagesScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
      >
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center px-1 pt-6 pb-4 text-center">
              <p className="text-sm text-ink-muted">
                Ask about your LaTeX project, fix errors, or search papers.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {quickActions.map((a) => (
                  <button
                    key={a.action}
                    type="button"
                    className={cn(
                      CHROME_CHIP,
                      "h-8 border border-border/80 bg-paper px-3 text-xs text-ink-muted hover:text-ink"
                    )}
                    disabled={a.disabled || loading}
                    onClick={() => void sendMessage(a.label, a.action)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "ai-message-enter max-w-[92%]",
                msg.role === "user"
                  ? "ml-auto rounded-2xl rounded-br-md bg-navy px-3.5 py-2 text-white shadow-sm"
                  : "mr-auto rounded-2xl rounded-bl-md bg-paper px-3.5 py-2 shadow-sm ring-1 ring-border/60"
              )}
            >
              {msg.role === "assistant" &&
                ((msg.usedPlugins && msg.usedPlugins.length > 0) ||
                  (msg.appliedActions && msg.appliedActions.length > 0) ||
                  (msg.toolReads && msg.toolReads.length > 0)) && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {msg.usedPlugins?.map((plugin) => (
                      <PluginChip key={`${plugin.id}-${plugin.source ?? "default"}`} plugin={plugin} />
                    ))}
                    {msg.toolReads?.map((read, idx) => (
                      <ToolReadChip key={`${read.path}-${idx}`} read={read} />
                    ))}
                    {msg.appliedActions?.map((action, idx) => (
                      <AppliedActionChip key={`${action.type}-${idx}`} action={action} />
                    ))}
                  </div>
                )}
              {msg.role === "user" ? (
                <div className="whitespace-pre-wrap text-sm leading-snug">{msg.content}</div>
              ) : (
                <AiMarkdown content={msg.content} />
              )}
              {msg.role === "assistant" && msg.isFailure && (
                <DetectedErrorReportFooter
                  sent={msg.autoReportSent}
                  message={msg.content}
                  kind="ai"
                  page={`/project/${projectId}`}
                  className="mt-2 justify-start"
                  linkClassName="text-xs"
                />
              )}
              {msg.role === "assistant" && msg.papers && msg.papers.length > 0 && onCitePaper && (
                <div className="mt-2.5 space-y-1.5 border-t border-border/70 pt-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                    Cite from search
                  </p>
                  {msg.papers.map((paper) => {
                    const citeId = paper.doi ?? paper.title;
                    const isCiting = citingKey === citeId;
                    return (
                      <div
                        key={citeId}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-canvas-dark/30 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-snug text-ink line-clamp-2">
                            {paper.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-ink-muted">
                            {formatAuthors(paper.authors)}
                            {paper.year != null ? ` · ${paper.year}` : ""}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 shrink-0 px-2 text-[11px]"
                          disabled={loading || isCiting}
                          onClick={() => void handleCite(paper)}
                        >
                          {isCiting ? "Citing…" : "Cite"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {msg.role === "assistant" && msg.arxivPapers && msg.arxivPapers.length > 0 && (
                <div className="mt-2.5 space-y-1.5 border-t border-border/70 pt-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                    From arXiv
                  </p>
                  {msg.arxivPapers.map((paper) => {
                    const isCiting = citingArxivId === paper.id;
                    return (
                      <div
                        key={paper.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-canvas-dark/30 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-snug text-ink line-clamp-2">
                            {paper.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-ink-muted">
                            {formatAuthors(paper.authors)}
                            {paper.year != null ? ` · ${paper.year}` : ""} · arXiv:{paper.id}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            disabled={loading}
                            onClick={() => openArxivPaper(paper)}
                          >
                            Open paper
                          </Button>
                          {onCiteArxivPaper && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] cursor-pointer"
                              disabled={loading || isCiting}
                              onClick={() => void handleCiteArxiv(paper)}
                            >
                              {isCiting ? "Citing…" : "Cite"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {msg.role === "assistant" && msg.zoteroItems && msg.zoteroItems.length > 0 && (
                <div className="mt-2.5 space-y-1.5 border-t border-border/70 pt-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                    From Zotero
                  </p>
                  {msg.zoteroItems.map((item) => {
                    const isCiting = citingZoteroKey === item.itemKey;
                    return (
                      <div
                        key={item.itemKey}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-canvas-dark/30 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium leading-snug text-ink line-clamp-2">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-ink-muted">
                            {formatAuthors(item.authors)}
                            {item.year != null ? ` · ${item.year}` : ""} · {item.itemType}
                          </p>
                        </div>
                        {onCiteZoteroItem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 px-2 text-[11px] cursor-pointer"
                            disabled={loading || isCiting}
                            onClick={() => void handleCiteZotero(item)}
                          >
                            {isCiting ? "Citing…" : "Cite"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {msg.role === "assistant" &&
                msg.content &&
                hasInsertableContent(msg.content) &&
                !msg.appliedActions?.length && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {canReplace && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-ink-muted"
                      onClick={() => onReplace?.(extractInsertableContent(msg.content))}
                    >
                      Replace selection
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-ink-muted"
                    onClick={() => onInsert(extractInsertableContent(msg.content))}
                  >
                    Insert at cursor
                  </Button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div
              className="ai-message-enter mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-paper px-3.5 py-2.5 shadow-sm ring-1 ring-border/60"
            >
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                {!hasStreamProgress ? (
                  <>
                    <TypingIndicator />
                    <span className="text-ink-faint">Thinking</span>
                  </>
                ) : (
                  <span className="leading-snug">{loadingMessage}</span>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 px-3 pt-2 pb-3",
          variant === "sheet" ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : ""
        )}
      >
        <form onSubmit={handleComposerSubmit}>
          <div
            className={cn(
              "rounded-2xl border border-border bg-paper shadow-sm transition-shadow",
              "focus-within:ring-2 focus-within:ring-accent/40 focus-within:ring-offset-1 focus-within:ring-offset-surface"
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder={composerPlaceholder}
              disabled={loading}
              rows={1}
              className={cn(
                "block w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm leading-snug placeholder:text-ink-faint",
                "focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
                variant === "sheet" ? "min-h-[44px] text-base" : "min-h-[36px]"
              )}
            />
            {selectedToolMeta ? (
              <AiComposerToolChip
                meta={selectedToolMeta}
                onClear={handleClearTool}
                disabled={toolsDisabled}
              />
            ) : null}
            <div className="flex items-end justify-between gap-1 px-2 pb-2">
              <div className="flex min-w-0 items-end gap-0.5">
                <AiComposerToolPicker
                  onSelectTool={handleSelectTool}
                  disabled={toolsDisabled}
                  variant={variant}
                  onFocusInput={focusComposerInput}
                />
                <Button
                  type="button"
                  size="icon"
                  variant={speech.isListening ? "default" : "ghost"}
                  className={cn(
                    "shrink-0 rounded-lg text-ink-muted",
                    variant === "sheet" ? "h-11 w-11" : "h-8 w-8"
                  )}
                  disabled={micDisabled}
                  onClick={handleVoiceToggle}
                  aria-label={speech.isListening ? "Stop voice input" : "Start voice input"}
                  title={speech.isListening ? "Stop and send" : "Voice input"}
                >
                  {speech.isListening ? (
                    <Square className="h-4 w-4" />
                  ) : speech.status === "denied" ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex shrink-0 items-end">
                {loading ? (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className={cn(
                      CHROME_STOP_BTN,
                      variant === "sheet" ? "h-11 min-w-[4.5rem] px-3" : "h-8 min-w-[4rem] px-2.5"
                    )}
                    aria-label="Stop generation"
                  >
                    <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                    <span>Stop</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={cn(
                      CHROME_SEND_BTN,
                      "shrink-0 rounded-full transition-opacity",
                      variant === "sheet" ? "h-11 w-11" : "h-8 w-8",
                      !canSend && "opacity-40"
                    )}
                    disabled={!canSend}
                    aria-label="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
