"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { FileTree, type FileNode } from "@/components/file-tree";
import { ImagePreview } from "@/components/image-preview";
import { LatexEditor } from "@/components/latex-editor";
import { PdfPreview } from "@/components/pdf-preview";
import {
  buildRenameMap,
  contentToBase64,
  contentToDataUrl,
  folderPathFromFile,
  folderPlaceholderPath,
  isBinaryAsset,
  isFolderPlaceholder,
  isImageFile,
  isPdfFile,
  isTextSourceFile,
  joinPath,
  mimeTypeForPath,
  projectZipFilename,
  readFileAsDataUrl,
  resolveMainFileAfterRename,
} from "@/lib/project-files";
import { CompilePanel } from "@/components/compile-panel";
import { ProjectSettingsDialog } from "@/components/project-settings-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { HistoryDialog } from "@/components/history-dialog";
import { useUiFeedback } from "@/components/ui-feedback";
import { CollabPresence } from "@/components/collab-presence";
import { AiSidebar, type AiPendingRequest } from "@/components/ai-sidebar";
import { AiSidebarPanel } from "@/components/ai-sidebar-panel";
import { useProjectAiChatThread } from "@/lib/use-project-ai-chat-thread";
import { buildCompileFixAiRequest, buildCompileFixAutoRetryRequest } from "@/lib/ai-compile-fix-intent";
import {
  beginCompileFixRetrySession,
  createCompileFixRetrySession,
  decideCompileFixAutoRetry,
  endCompileFixRetrySession,
  markCompileFixEditsApplied,
} from "@/lib/compile-fix-auto-retry";
import { AiAssistantFab } from "@/components/ai-assistant-fab";
import { SelectionAiBubble } from "@/components/selection-ai-bubble";
import { EditorStatusBar, EditorToolbar } from "@/components/editor-toolbar";
import { LayoutModeSwitcher } from "@/components/layout-mode-switcher";
import { MobileWorkspaceTabs } from "@/components/mobile-workspace-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  CHROME_ICON_BTN_MD,
  CHROME_ICON_BTN_SM,
  CHROME_MENU_ITEM,
  CHROME_TOOLBAR_BTN,
} from "@/lib/chrome-interactive";
import { cn } from "@/components/ui/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { leaveForLogin } from "@/lib/auth-redirect";
import { handleDashboardBackClick } from "@/lib/hard-navigation";
import { useRequireSession } from "@/lib/use-require-session";
import {
  Play,
  Share2,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Settings,
  History,
  X,
  MoreHorizontal,
} from "lucide-react";
import type { EditorView } from "@codemirror/view";
import type { Project } from "@/lib/schema";
import type { DocumentStats } from "@/lib/document-stats";
import { countDocumentStats } from "@/lib/document-stats";
import type { SaveStatus } from "@/lib/save-status";
import { saveProjectFile } from "@/lib/save-file";
import { runCollabSaveFallback } from "@/lib/collab-save-fallback";
import type { AiPaper, ArxivPaperResult, DoiCitationPayload } from "@/lib/ai-types";
import {
  appendBibEntry,
  formatBibtexEntry,
  mergeBibtexEntry,
  parseBibKeys,
  resolveProjectBibPath,
  suggestCitationKey,
} from "@/lib/bibtex";
import { formatArxivBibtexEntry } from "@/lib/arxiv";
import { canManageSharing, type ProjectRole } from "@/lib/project-sharing";
import {
  countCompileErrors,
  deriveProofStaleAfterCompile,
  shouldShowStaleProofBanner,
} from "@/lib/proof-stale-state";
import {
  createCompileScheduler,
  scheduleCompileAfterAppliedActions,
} from "@/lib/schedule-compile-after-ai-actions";
import type { AiClientAction } from "@/lib/ai-client-actions";
import {
  effectiveLayoutMode,
  layoutModeToMobileTab,
  layoutShowsProof,
  mobileTabToLayoutMode,
  openProofLayout,
  persistLayoutMode,
  persistProofLayoutPreference,
  readProofLayoutPreference,
  readStoredLayoutMode,
  type MobileWorkspaceTab,
  type ProofLayoutPreference,
  type WorkspaceLayoutMode,
} from "@/lib/workspace-layout";

interface CompileError {
  line?: number;
  file?: string;
  message: string;
  severity: "error" | "warning";
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { confirm, notice } = useUiFeedback();
  const projectId = params.id as string;
  const { isAuthenticated } = useRequireSession({ loginNext: `/project/${projectId}` });

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [userRole, setUserRole] = useState<ProjectRole>("viewer");
  const [collabToken, setCollabToken] = useState<string | null>(null);
  const [collabBaseUrl, setCollabBaseUrl] = useState("ws://localhost:1234");

  const [compiling, setCompiling] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [proofIsStale, setProofIsStale] = useState(false);
  const [synctexData, setSynctexData] = useState<string | null>(null);
  const [compileLog, setCompileLog] = useState("");
  const [compileErrors, setCompileErrors] = useState<CompileError[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [jumpToLine, setJumpToLine] = useState<number | null>(null);
  const [documentStats, setDocumentStats] = useState<DocumentStats>({
    words: 0,
    characters: 0,
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");

  const [showOutline, setShowOutline] = useState(true);
  const [layoutMode, setLayoutMode] = useState<WorkspaceLayoutMode>("editor");
  const [mobileTab, setMobileTab] = useState<MobileWorkspaceTab>("editor");
  const [proofLayoutPreference, setProofLayoutPreference] =
    useState<ProofLayoutPreference>("columns");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [aiPendingRequest, setAiPendingRequest] = useState<AiPendingRequest | null>(null);
  const { messages: aiChatMessages, setMessages: setAiChatMessages } =
    useProjectAiChatThread(projectId);
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const editorViewRef = useRef<EditorView | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSaveRef = useRef<{ path: string; content: string } | null>(null);
  const collabTokenRef = useRef<string | null>(null);
  const compileSchedulerRef = useRef<ReturnType<typeof createCompileScheduler> | null>(null);
  const compileFixRetryRef = useRef(createCompileFixRetrySession());

  useEffect(() => {
    const mode = readStoredLayoutMode();
    setLayoutMode(mode);
    setProofLayoutPreference(readProofLayoutPreference());
    setMobileTab(layoutModeToMobileTab(mode));
  }, []);

  useEffect(() => {
    if (isNarrow) {
      setMobileTab(layoutModeToMobileTab(layoutMode));
    }
  }, [isNarrow, layoutMode]);

  const updateLayoutMode = useCallback(
    (mode: WorkspaceLayoutMode) => {
      setLayoutMode(mode);
      persistLayoutMode(mode);
      if (mode === "columns" || mode === "proof") {
        setProofLayoutPreference(mode);
        persistProofLayoutPreference(mode);
      }
      if (isNarrow) {
        setMobileTab(layoutModeToMobileTab(mode));
      }
    },
    [isNarrow]
  );

  const openProof = useCallback(() => {
    if (isNarrow) {
      setMobileTab("proof");
      setLayoutMode("proof");
      persistLayoutMode("proof");
      return;
    }
    const next = openProofLayout(proofLayoutPreference);
    updateLayoutMode(next);
  }, [isNarrow, proofLayoutPreference, updateLayoutMode]);

  const handleMobileTabChange = useCallback(
    (tab: MobileWorkspaceTab) => {
      setMobileTab(tab);
      if (tab !== "files") {
        updateLayoutMode(mobileTabToLayoutMode(tab));
      }
    },
    [updateLayoutMode]
  );

  const openFromMobileMenu = useCallback((open: () => void) => {
    setShowMobileMenu(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => open());
    });
  }, []);

  const loadProject = useCallback(async () => {
    const [projRes, filesRes, collabRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch(`/api/projects/${projectId}/files`),
      fetch(`/api/projects/${projectId}/collab`),
    ]);

    if (projRes.status === 401) {
      setProject(null);
      setFiles([]);
      leaveForLogin(`/project/${projectId}`);
      return;
    }
    if (projRes.status === 404) {
      router.push("/dashboard");
      return;
    }

    const proj = await projRes.json();
    const fileList = await filesRes.json();
    const collab = await collabRes.json();

    setProject(proj);
    setFiles(
      fileList.map((f: { path: string; content: string; isBinary?: boolean }) => ({
        path: f.path,
        content: f.content,
        isBinary: f.isBinary ?? isBinaryAsset(f.path),
      }))
    );
    setCanEdit(collab.canEdit);
    setUserRole(collab.role ?? "viewer");
    setCollabToken(collab.token);

    const wsUrl = collab.wsUrl || "";
    const match = wsUrl.match(/^(wss?:\/\/[^/]+)/);
    if (match) setCollabBaseUrl(match[1]);

    if (!activeFile && fileList.length > 0) {
      const preferred = fileList.find(
        (f: { path: string }) => f.path === proj.mainFile && !isFolderPlaceholder(f.path)
      );
      const firstSelectable = fileList.find(
        (f: { path: string }) => !isFolderPlaceholder(f.path)
      );
      setActiveFile(preferred?.path || firstSelectable?.path || fileList[0].path);
    }
  }, [projectId, activeFile]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProject(null);
      setFiles([]);
      setShowSettings(false);
      return;
    }
    loadProject();
  }, [isAuthenticated, loadProject]);

  useEffect(() => {
    collabTokenRef.current = collabToken;
    if (collabToken && canEdit) {
      setSaveStatus("syncing");
    }
  }, [collabToken, canEdit]);

  const saveFile = useCallback(
    async (path: string, content: string, isBinary = false): Promise<boolean> => {
      if (!canEdit) return false;

      if (!collabTokenRef.current) {
        setSaveStatus("saving");
      }

      const result = await saveProjectFile(projectId, path, content, isBinary, { retry: true });

      if (!result.ok) {
        console.error("[save] failed to persist file:", path, result.error);
        if (!collabTokenRef.current) {
          setSaveStatus("failed");
        }
        return false;
      }

      if (!collabTokenRef.current) {
        setSaveStatus("saved");
      }

      setFiles((prev) => {
        const existing = prev.find((f) => f.path === path);
        if (existing) {
          return prev.map((f) =>
            f.path === path ? { ...f, content, isBinary } : f
          );
        }
        return [...prev, { path, content, isBinary }];
      });
      return true;
    },
    [projectId, canEdit]
  );

  const flushPendingEditorSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    await saveFile(pending.path, pending.content, false);
  }, [saveFile]);

  const handleEditorChange = useCallback(
    (content: string) => {
      if (!activeFile) return;
      if (collabTokenRef.current) return;

      pendingSaveRef.current = { path: activeFile, content };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setSaveStatus("saving");
      saveTimeoutRef.current = setTimeout(() => {
        pendingSaveRef.current = null;
        void saveFile(activeFile, content);
      }, 1000);
    },
    [activeFile, saveFile]
  );

  const clearPendingEditorSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      void flushPendingEditorSave();
    };
  }, [activeFile, flushPendingEditorSave]);

  const compile = useCallback(async () => {
    const hadPdfBeforeCompile = pdfData !== null;
    let compileErrorCount = 0;
    setCompiling(true);
    setCompileErrors([]);
    openProof();
    setShowLog(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/compile`, { method: "POST" });
      const result = await res.json();
      if (result.error) {
        setCompileLog("");
        const errors: CompileError[] = [{ message: result.error, severity: "error" }];
        compileErrorCount = errors.length;
        setCompileErrors(errors);
        const stale = deriveProofStaleAfterCompile(hadPdfBeforeCompile, { success: false }, errors);
        setProofIsStale(stale.isStale);
      } else {
        setCompileLog(result.log || "");
        let errors: CompileError[] = result.errors || [];
        if (!result.success && !errors.some((e) => e.severity === "error")) {
          errors = [
            ...errors,
            {
              message: result.log?.trim()
                ? "Compilation failed — see log for details"
                : "Compilation failed",
              severity: "error",
            },
          ];
        }
        compileErrorCount = countCompileErrors(errors);
        setCompileErrors(errors);
        const stale = deriveProofStaleAfterCompile(hadPdfBeforeCompile, result, errors);
        setProofIsStale(stale.isStale);
        if (!result.success && result.log?.trim()) {
          setShowLog(true);
        }
        if (result.success && result.pdf) {
          setPdfData(result.pdf);
          setSynctexData(result.synctex ?? null);
        } else if (!result.success) {
          setSynctexData(result.synctex ?? null);
        }
      }
    } catch {
      setCompileLog("");
      const errors: CompileError[] = [{ message: "Failed to compile", severity: "error" }];
      compileErrorCount = errors.length;
      setCompileErrors(errors);
      const stale = deriveProofStaleAfterCompile(hadPdfBeforeCompile, { success: false }, errors);
      setProofIsStale(stale.isStale);
    } finally {
      setCompiling(false);

      const retryDecision = decideCompileFixAutoRetry(
        compileFixRetryRef.current,
        compileErrorCount
      );
      if (retryDecision.shouldRetry) {
        setAiPendingRequest(buildCompileFixAutoRetryRequest());
        setShowAi(true);
      }
    }
  }, [openProof, pdfData, projectId]);

  useEffect(() => {
    compileSchedulerRef.current = createCompileScheduler(compile);
  }, [compile]);

  const handleCompileFixSessionStart = useCallback(() => {
    beginCompileFixRetrySession(compileFixRetryRef.current);
  }, []);

  const handleCompileFixRetryNoOp = useCallback(() => {
    endCompileFixRetrySession(compileFixRetryRef.current);
  }, []);

  const handleCompileFixActionsApplied = useCallback(
    async (applied: AiClientAction[]) => {
      markCompileFixEditsApplied(compileFixRetryRef.current, applied.length);

      const scheduler = compileSchedulerRef.current;
      if (!scheduler) return;

      await scheduleCompileAfterAppliedActions({
        isCompileFixTurn: true,
        applied,
        activeFile,
        flushContext: {
          activeFile,
          editorView,
          saveFile: async (path, content) => {
            await saveFile(path, content, false);
          },
          clearPendingEditorSave,
        },
        compileScheduler: scheduler,
      });
    },
    [activeFile, clearPendingEditorSave, editorView, saveFile]
  );

  async function createFile(path: string) {
    if (!canEdit) return;
    await saveFile(path, "", false);
    setActiveFile(path);
  }

  async function createFolder(folderName: string) {
    if (!canEdit) return;
    const path = folderPlaceholderPath(folderName);
    await saveFile(path, "", false);
  }

  async function deleteFile(path: string) {
    if (!canEdit) return;
    const ok = await confirm({
      message: `Delete ${path}?`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    await fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    });
    setFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeFile === path) {
      setActiveFile(files.find((f) => f.path !== path && !isFolderPlaceholder(f.path))?.path || null);
    }
  }

  async function deleteFolder(path: string) {
    if (!canEdit) return;
    const ok = await confirm({
      message: `Delete folder ${path} and all its contents?`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(
      `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}&recursive=true`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const err = await res.json();
      notice({ message: err.error || "Failed to delete folder", variant: "error" });
      return;
    }
    const result = await res.json();
    const deleted = new Set<string>(result.deleted ?? []);
    setFiles((prev) => prev.filter((f) => !deleted.has(f.path)));
    if (activeFile && deleted.has(activeFile)) {
      setActiveFile(files.find((f) => !deleted.has(f.path) && !isFolderPlaceholder(f.path))?.path || null);
    }
  }

  async function renamePath(from: string, to: string) {
    if (!canEdit) return;
    const res = await fetch(`/api/projects/${projectId}/files`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    if (!res.ok) {
      const err = await res.json();
      notice({ message: err.error || "Failed to rename", variant: "error" });
      return;
    }

    const result = await res.json();
    const renameResult = buildRenameMap(
      files.map((file) => file.path),
      from,
      to
    );
    if (!renameResult.ok) return;

    const pathMap = renameResult.map;
    setFiles((prev) =>
      prev.map((file) => {
        const newPath = pathMap.get(file.path);
        return newPath ? { ...file, path: newPath } : file;
      })
    );

    if (activeFile) {
      setActiveFile(resolveMainFileAfterRename(activeFile, pathMap));
    }

    if (result.mainFile && project && result.mainFile !== project.mainFile) {
      setProject({ ...project, mainFile: result.mainFile });
    }
  }

  function downloadSource() {
    const filename = projectZipFilename(project?.name ?? "manuscript");
    const link = document.createElement("a");
    link.href = `/api/projects/${projectId}/download`;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function uploadFiles(fileList: FileList) {
    if (!canEdit) return;
    const folder = folderPathFromFile(activeFile ?? "");
    for (const file of Array.from(fileList)) {
      const path = joinPath(folder, file.name);
      const isBinary = isBinaryAsset(path);
      const content = isBinary ? await readFileAsDataUrl(file) : await file.text();
      await saveFile(path, content, isBinary);
      if (!activeFile || isFolderPlaceholder(activeFile)) {
        setActiveFile(path);
      }
    }
  }

  function handleInsertAtCursor(text: string) {
    const view = editorViewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    if (isNarrow) {
      setShowAi(false);
      setMobileTab("editor");
    }
  }

  function handleReplaceSelection(text: string) {
    const view = editorViewRef.current;
    if (!view || !selectedText) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    if (isNarrow) {
      setShowAi(false);
      setMobileTab("editor");
    }
  }

  const fileContentsMap = Object.fromEntries(files.map((f) => [f.path, f.content]));
  if (activeFile && editorView) {
    fileContentsMap[activeFile] = editorView.state.doc.toString();
  }

  const aiApplyActionsContext = {
    activeFile,
    editorView,
    fileContents: fileContentsMap,
    saveFile: async (path: string, content: string) => {
      if (collabTokenRef.current) {
        const ok = await runCollabSaveFallback({ projectId, path, content });
        if (ok) {
          setFiles((prev) => {
            const existing = prev.find((f) => f.path === path);
            if (existing) {
              return prev.map((f) => (f.path === path ? { ...f, content } : f));
            }
            return [...prev, { path, content, isBinary: false }];
          });
        }
        return;
      }
      await saveFile(path, content, false);
    },
    onSwitchFile: (path: string) => setActiveFile(path),
  };

  async function applyDoiCitation(result: {
    bibtex: string;
    citationKey: string;
    title: string;
    source: string;
  }) {
    if (!canEdit || !project) return;

    const filePaths = files.map((file) => file.path);
    const fileContents = Object.fromEntries(files.map((file) => [file.path, file.content]));
    const bibPath = resolveProjectBibPath({
      mainFile: project.mainFile,
      filePaths,
      fileContents,
    });

    const existingBib = fileContents[bibPath] ?? "";
    const { content: updatedBib, merged } = mergeBibtexEntry(
      existingBib,
      result.bibtex,
      result.citationKey
    );

    if (merged || !existingBib) {
      await saveFile(bibPath, updatedBib, false);
    }

    handleInsertAtCursor(`\\cite{${result.citationKey}}`);
    const sourceLabel = result.source === "openalex" ? "OpenAlex" : "Crossref";
    notice({ message: `Cited “${result.title}” (${sourceLabel})`, variant: "success" });
  }

  async function handleDoiPaste(doi: string) {
    if (!canEdit) return;

    const res = await fetch(`/api/projects/${projectId}/integrations/cite-doi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doi }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      notice({
        message: typeof err.error === "string" ? err.error : "Could not resolve DOI",
        variant: "error",
      });
      return;
    }

    const data = await res.json();
    await applyDoiCitation(data);
  }

  async function handleApplyDoiCitation(citation: DoiCitationPayload) {
    await applyDoiCitation(citation);
  }

  async function handleCiteArxivPaper(paper: ArxivPaperResult) {
    if (!canEdit || !project) return;

    const filePaths = files.map((file) => file.path);
    const fileContents = Object.fromEntries(files.map((file) => [file.path, file.content]));
    const bibPath = resolveProjectBibPath({
      mainFile: project.mainFile,
      filePaths,
      fileContents,
    });

    const existingBib = fileContents[bibPath] ?? "";
    const existingKeys = parseBibKeys(existingBib);
    const citationKey = suggestCitationKey(
      {
        title: paper.title,
        year: paper.year,
        authors: paper.authors,
        venue: "arXiv preprint",
        doi: null,
        url: paper.sourceUrl,
        source: "openalex",
      },
      existingKeys
    );
    const entry = formatArxivBibtexEntry(
      {
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        year: paper.year,
        abstract: paper.abstract,
        pdfUrl: paper.pdfUrl,
        sourceUrl: paper.sourceUrl,
        publishedAt: null,
      },
      citationKey
    );
    const updatedBib = appendBibEntry(existingBib, entry, citationKey);

    if (updatedBib !== existingBib) {
      await saveFile(bibPath, updatedBib, false);
    }

    handleInsertAtCursor(`\\cite{${citationKey}}`);
    notice({ message: `Cited “${paper.title}” (arXiv)`, variant: "success" });
  }

  async function handleCitePaper(paper: AiPaper) {
    if (!canEdit || !project) return;

    const filePaths = files.map((file) => file.path);
    const fileContents = Object.fromEntries(files.map((file) => [file.path, file.content]));
    const bibPath = resolveProjectBibPath({
      mainFile: project.mainFile,
      filePaths,
      fileContents,
    });

    const existingBib = fileContents[bibPath] ?? "";
    const existingKeys = parseBibKeys(existingBib);
    const citationKey = suggestCitationKey(paper, existingKeys);
    const entry = formatBibtexEntry(paper, citationKey);
    const updatedBib = appendBibEntry(existingBib, entry, citationKey);

    if (updatedBib !== existingBib) {
      await saveFile(bibPath, updatedBib, false);
    }

    handleInsertAtCursor(`\\cite{${citationKey}}`);
  }

  function handleFixCompileWithAi() {
    setAiPendingRequest(buildCompileFixAiRequest());
    setShowAi(true);
  }

  function handleJumpToLine(line: number, file?: string) {
    if (file && file !== activeFile) {
      setActiveFile(file);
    }
    setJumpToLine(line);
    setTimeout(() => setJumpToLine(null), 100);
  }

  function handleGoToLine(line: number) {
    handleJumpToLine(line);
  }

  const activeFileNode = files.find((f) => f.path === activeFile);
  const activeFileContent = activeFileNode?.content || "";
  const workspaceLayoutMode = effectiveLayoutMode(layoutMode, isNarrow);
  const showingProof = layoutShowsProof(workspaceLayoutMode);
  const isTextEditorFile =
    !!activeFile &&
    !isFolderPlaceholder(activeFile) &&
    (isTextSourceFile(activeFile) || !activeFileNode?.isBinary);

  useEffect(() => {
    if (!isTextEditorFile || !activeFile) {
      setDocumentStats({ words: 0, characters: 0 });
      return;
    }
    setDocumentStats(countDocumentStats(activeFileContent));
  }, [activeFile, activeFileContent, isTextEditorFile]);

  useEffect(() => {
    if (!isTextEditorFile) {
      editorViewRef.current = null;
      setEditorView(null);
    }
  }, [isTextEditorFile, activeFile]);

  function renderActiveFileViewer() {
    if (!activeFile || isFolderPlaceholder(activeFile)) {
      return (
        <div className="flex items-center justify-center h-full text-ink-muted font-serif">
          Select a file from the outline
        </div>
      );
    }

    if (isImageFile(activeFile)) {
      const src = activeFileContent.startsWith("data:")
        ? activeFileContent
        : contentToDataUrl(activeFileContent, mimeTypeForPath(activeFile));
      return <ImagePreview src={src} alt={activeFile} />;
    }

    if (isPdfFile(activeFile) && activeFileNode?.isBinary) {
      return <PdfPreview pdfData={contentToBase64(activeFileContent)} />;
    }

    if (isTextSourceFile(activeFile) || !activeFileNode?.isBinary) {
      return (
        <LatexEditor
          key={activeFile}
          filePath={activeFile}
          projectId={projectId}
          initialContent={activeFileContent}
          collabToken={collabToken}
          collabBaseUrl={collabBaseUrl}
          canEdit={canEdit}
          onChange={handleEditorChange}
          onEditorReady={(view) => {
            editorViewRef.current = view;
            setEditorView(view);
            const syncSelection = () => {
              const { from, to } = view.state.selection.main;
              const text = from === to ? "" : view.state.sliceDoc(from, to).trim();
              setSelectedText(text);
            };
            syncSelection();
            view.dom.addEventListener("mouseup", syncSelection);
            view.dom.addEventListener("keyup", syncSelection);
          }}
          onStatsChange={setDocumentStats}
          onSaveStatusChange={canEdit ? setSaveStatus : undefined}
          jumpToLine={jumpToLine}
          onDoiPaste={canEdit ? handleDoiPaste : undefined}
        />
      );
    }

    return (
      <div className="flex items-center justify-center h-full text-ink-muted text-sm px-6 text-center">
        Preview is not available for this file type.
      </div>
    );
  }

  const editorPane = (
    <div className="workspace-pane">
      {activeFile && !isFolderPlaceholder(activeFile) ? (
        <>
          <div className="workspace-pane-header">{activeFile}</div>
          {isTextEditorFile && (
            <EditorToolbar editorView={editorView} onGoToLine={handleGoToLine} />
          )}
          <div className="flex-1 min-h-0 overflow-hidden">{renderActiveFileViewer()}</div>
          {isTextEditorFile && (
            <EditorStatusBar
              filePath={activeFile}
              wordCount={documentStats.words}
              characterCount={documentStats.characters}
              saveStatus={saveStatus}
              showSaveStatus={canEdit}
            />
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-ink-muted font-serif">
          Select a file from the outline
        </div>
      )}
    </div>
  );

  const compileErrorCount = countCompileErrors(compileErrors);
  const showStaleProofBanner = shouldShowStaleProofBanner(proofIsStale, pdfData);

  const proofPane = (
    <div className="workspace-pane">
      <div className="workspace-pane-header flex items-center gap-2">
        <BookOpen
          className={cn(
            "h-3.5 w-3.5",
            showStaleProofBanner ? "text-error" : "text-accent"
          )}
        />
        <span>Proof</span>
        {showStaleProofBanner && (
          <span
            className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-error/15 text-error border border-error/25"
          >
            Outdated
          </span>
        )}
      </div>
      <PdfPreview
        pdfData={pdfData}
        synctexData={synctexData}
        projectFiles={files.map((f) => f.path)}
        onJumpToLine={handleJumpToLine}
        loading={compiling}
        showDownload
        downloadFilename={project?.name ?? "manuscript"}
        compileFailed={compileErrorCount > 0}
        compileErrors={compileErrors}
        isStale={showStaleProofBanner}
        staleErrorCount={compileErrorCount}
        onFixWithAi={handleFixCompileWithAi}
      />
    </div>
  );

  const filesPane = (
    <div className="workspace-pane">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-light">
        <span className="text-xs font-medium tracking-wide uppercase text-ink-faint">Files</span>
      </div>
      <FileTree
        files={files}
        activeFile={activeFile}
        onSelect={(path) => {
          setActiveFile(path);
          handleMobileTabChange("editor");
        }}
        onCreate={createFile}
        onCreateFolder={createFolder}
        onRename={renamePath}
        onDelete={deleteFile}
        onDeleteFolder={deleteFolder}
        onUpload={uploadFiles}
        onDownloadSource={downloadSource}
        canEdit={canEdit}
      />
    </div>
  );

  function renderWorkspace() {
    if (isNarrow && mobileTab === "files") {
      return filesPane;
    }

    if (workspaceLayoutMode === "editor") {
      return editorPane;
    }

    if (workspaceLayoutMode === "proof") {
      return proofPane;
    }

    if (workspaceLayoutMode === "columns") {
      return (
        <PanelGroup
          direction="horizontal"
          autoSaveId="quire-workspace-columns"
          className="flex-1 min-h-0"
        >
          <Panel defaultSize={55} minSize={20}>
            {editorPane}
          </Panel>
          <PanelResizeHandle className="panel-resize-handle" />
          <Panel defaultSize={45} minSize={20}>
            {proofPane}
          </Panel>
        </PanelGroup>
      );
    }

    return (
      <PanelGroup
        direction="vertical"
        autoSaveId="quire-workspace-rows"
        className="flex-1 min-h-0"
      >
        <Panel defaultSize={55} minSize={20}>
          {editorPane}
        </Panel>
        <PanelResizeHandle className="panel-resize-handle" />
        <Panel defaultSize={45} minSize={20}>
          {proofPane}
        </Panel>
      </PanelGroup>
    );
  }

  if (!isAuthenticated || !project) {
    return (
      <div className="flex items-center justify-center h-[100dvh] text-ink-muted font-serif">
        Loading manuscript…
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-canvas overflow-hidden">
      <header className="relative z-30 h-11 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 border-b border-border bg-paper/90 backdrop-blur-sm pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <a
            href="/dashboard"
            aria-label="Back to manuscripts"
            title="Back to manuscripts"
            className={CHROME_ICON_BTN_MD}
            onClick={handleDashboardBackClick}
          >
            <ChevronLeft className="h-4 w-4" />
          </a>
          <button
            onClick={() => setShowOutline(!showOutline)}
            className={`${CHROME_ICON_BTN_MD} hidden sm:block lg:hidden`}
            title={showOutline ? "Hide outline" : "Show outline"}
          >
            {showOutline ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <h1 className="font-serif text-base font-medium truncate">{project.name}</h1>
          <CollabPresence
            projectId={projectId}
            collabToken={collabToken}
            collabBaseUrl={collabBaseUrl}
            className="hidden md:flex items-center gap-2 min-w-0"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <LayoutModeSwitcher mode={layoutMode} onChange={updateLayoutMode} className="hidden sm:inline-flex" />
          <ThemeToggle compact />
          <Button variant="default" size="sm" onClick={compile} disabled={compiling}>
            <Play className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{compiling ? "Typesetting…" : "Compile"}</span>
          </Button>
          <Button
            variant={showingProof ? "secondary" : "ghost"}
            size="sm"
            onClick={openProof}
            className="hidden sm:inline-flex"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Proof</span>
          </Button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className={cn(CHROME_TOOLBAR_BTN, "hidden sm:inline-flex h-8 px-3")}
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">History</span>
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className={cn(CHROME_TOOLBAR_BTN, "hidden sm:inline-flex h-8 px-3")}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowShare(true)}
            className={cn(CHROME_TOOLBAR_BTN, "hidden sm:inline-flex h-8 px-3")}
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <div className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={cn(
                CHROME_ICON_BTN_MD,
                "flex h-11 w-11 items-center justify-center"
              )}
              aria-expanded={showMobileMenu}
              aria-haspopup="menu"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {showMobileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMobileMenu(false)}
                  aria-hidden
                />
                <div
                  className="absolute right-0 top-full mt-1 z-50 min-w-[10rem] rounded-sm border border-border bg-paper py-1 shadow-lg"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(CHROME_MENU_ITEM, "w-full px-3 py-2.5 text-sm text-left")}
                    onClick={() => openFromMobileMenu(() => setShowShare(true))}
                  >
                    Share
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      className={cn(CHROME_MENU_ITEM, "w-full px-3 py-2.5 text-sm text-left")}
                      onClick={() => openFromMobileMenu(() => setShowHistory(true))}
                    >
                      History
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      className={cn(CHROME_MENU_ITEM, "w-full px-3 py-2.5 text-sm text-left")}
                      onClick={() => openFromMobileMenu(() => setShowSettings(true))}
                    >
                      Settings
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {showOutline && (
          <aside className="w-52 shrink-0 border-r border-border bg-paper flex flex-col hidden lg:flex">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-light">
              <span className="text-xs font-medium tracking-wide uppercase text-ink-faint">Outline</span>
              <button
                onClick={() => setShowOutline(false)}
                className={CHROME_ICON_BTN_SM}
                title="Collapse outline"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
            <FileTree
              files={files}
              activeFile={activeFile}
              onSelect={setActiveFile}
              onCreate={createFile}
              onCreateFolder={createFolder}
              onRename={renamePath}
              onDelete={deleteFile}
              onDeleteFolder={deleteFolder}
              onUpload={uploadFiles}
              onDownloadSource={downloadSource}
              canEdit={canEdit}
            />
          </aside>
        )}

        {!showOutline && (
          <button
            onClick={() => setShowOutline(true)}
            className={`hidden lg:flex absolute left-0 top-3 z-10 ml-1 ${CHROME_ICON_BTN_MD} rounded-r-md bg-paper border border-l-0 border-border shadow-sm`}
            title="Show outline"
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </button>
        )}

        {showOutline && (
          <aside className="hidden sm:flex lg:hidden absolute inset-y-0 left-0 w-64 z-30 bg-paper border-r border-border shadow-lg flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-light">
              <span className="text-xs font-medium tracking-wide uppercase text-ink-faint">Outline</span>
              <button onClick={() => setShowOutline(false)} className={CHROME_ICON_BTN_SM}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <FileTree
              files={files}
              activeFile={activeFile}
              onSelect={(path) => {
                setActiveFile(path);
                setShowOutline(false);
              }}
              onCreate={createFile}
              onCreateFolder={createFolder}
              onRename={renamePath}
              onDelete={deleteFile}
              onDeleteFolder={deleteFolder}
              onUpload={uploadFiles}
              onDownloadSource={downloadSource}
              canEdit={canEdit}
            />
          </aside>
        )}

        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden overflow-x-hidden">
            {renderWorkspace()}
          </div>
          <CompilePanel
            log={compileLog}
            errors={compileErrors}
            onJumpToLine={handleJumpToLine}
            showLog={showLog}
            onToggleLog={() => setShowLog(!showLog)}
            onFixWithAi={handleFixCompileWithAi}
          />
          <MobileWorkspaceTabs activeTab={mobileTab} onChange={handleMobileTabChange} />
        </main>

        {showAi && (
          <>
            {!isNarrow && (
              <div className="absolute inset-0 bg-ink/10 z-20" onClick={() => setShowAi(false)} />
            )}
            {isNarrow ? (
              <div className="absolute inset-0 z-30 flex flex-col min-h-0 bg-surface">
                <AiSidebar
                  projectId={projectId}
                  activeFile={activeFile}
                  selectedText={selectedText}
                  compileErrors={compileErrors}
                  onInsert={handleInsertAtCursor}
                  onReplace={handleReplaceSelection}
                  onCitePaper={canEdit ? handleCitePaper : undefined}
                  onApplyDoiCitation={canEdit ? handleApplyDoiCitation : undefined}
                  onCiteArxivPaper={canEdit ? handleCiteArxivPaper : undefined}
                  applyActionsContext={canEdit ? aiApplyActionsContext : undefined}
                  onClose={() => setShowAi(false)}
                  variant="sheet"
                  pendingRequest={aiPendingRequest}
                  onPendingRequestConsumed={() => setAiPendingRequest(null)}
                  onCompileFixActionsApplied={canEdit ? handleCompileFixActionsApplied : undefined}
                  onCompileFixSessionStart={canEdit ? handleCompileFixSessionStart : undefined}
                  onCompileFixRetryNoOp={canEdit ? handleCompileFixRetryNoOp : undefined}
                  messages={aiChatMessages}
                  setMessages={setAiChatMessages}
                />
              </div>
            ) : (
              <AiSidebarPanel>
                <AiSidebar
                  projectId={projectId}
                  activeFile={activeFile}
                  selectedText={selectedText}
                  compileErrors={compileErrors}
                  onInsert={handleInsertAtCursor}
                  onReplace={handleReplaceSelection}
                  onCitePaper={canEdit ? handleCitePaper : undefined}
                  onApplyDoiCitation={canEdit ? handleApplyDoiCitation : undefined}
                  onCiteArxivPaper={canEdit ? handleCiteArxivPaper : undefined}
                  applyActionsContext={canEdit ? aiApplyActionsContext : undefined}
                  onClose={() => setShowAi(false)}
                  variant="sidebar"
                  pendingRequest={aiPendingRequest}
                  onPendingRequestConsumed={() => setAiPendingRequest(null)}
                  onCompileFixActionsApplied={canEdit ? handleCompileFixActionsApplied : undefined}
                  onCompileFixSessionStart={canEdit ? handleCompileFixSessionStart : undefined}
                  onCompileFixRetryNoOp={canEdit ? handleCompileFixRetryNoOp : undefined}
                  messages={aiChatMessages}
                  setMessages={setAiChatMessages}
                />
              </AiSidebarPanel>
            )}
          </>
        )}

        {!showAi && <AiAssistantFab onClick={() => setShowAi(true)} />}

        {isTextEditorFile && (
          <SelectionAiBubble
            editorView={editorView}
            projectId={projectId}
            activeFile={activeFile}
            inlineContext={{ applyActionsContext: aiApplyActionsContext }}
          />
        )}
      </div>

      {showShare && project && (
        <ShareDialog
          open={showShare}
          projectId={projectId}
          projectName={project.name}
          canManage={canManageSharing(userRole)}
          onClose={() => setShowShare(false)}
        />
      )}

      {isAuthenticated && showSettings && project && (
        <ProjectSettingsDialog
          project={project}
          open={showSettings}
          onClose={() => setShowSettings(false)}
          onSaved={(updated) => {
            setProject(updated);
            if (updated.mainFile !== activeFile && files.some((f) => f.path === updated.mainFile)) {
              setActiveFile(updated.mainFile);
            }
          }}
        />
      )}

      {showHistory && project && (
        <HistoryDialog
          open={showHistory}
          projectId={projectId}
          canEdit={canEdit}
          onClose={() => setShowHistory(false)}
          onRestored={({ project: restoredProject, files: restoredFiles, pdf }) => {
            setProject(restoredProject);
            setFiles(
              restoredFiles.map((file) => ({
                path: file.path,
                content: file.content,
                isBinary: file.isBinary,
              }))
            );
            if (
              activeFile &&
              !restoredFiles.some((file) => file.path === activeFile)
            ) {
              setActiveFile(restoredProject.mainFile);
            }
            if (pdf) {
              setPdfData(pdf);
              setProofIsStale(false);
            }
          }}
        />
      )}
    </div>
  );
}
