"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import { CollabPresence } from "@/components/collab-presence";
import { AiSidebar } from "@/components/ai-sidebar";
import { EditorStatusBar, EditorToolbar } from "@/components/editor-toolbar";
import { LayoutModeSwitcher } from "@/components/layout-mode-switcher";
import { MobileWorkspaceTabs } from "@/components/mobile-workspace-tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/use-media-query";
import {
  Play,
  Sparkles,
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
import { canManageSharing, type ProjectRole } from "@/lib/project-sharing";
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
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [userRole, setUserRole] = useState<ProjectRole>("viewer");
  const [collabToken, setCollabToken] = useState<string | null>(null);
  const [collabBaseUrl, setCollabBaseUrl] = useState("ws://localhost:1234");

  const [compiling, setCompiling] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [synctexData, setSynctexData] = useState<string | null>(null);
  const [compileLog, setCompileLog] = useState("");
  const [compileErrors, setCompileErrors] = useState<CompileError[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [jumpToLine, setJumpToLine] = useState<number | null>(null);
  const [documentStats, setDocumentStats] = useState<DocumentStats>({
    words: 0,
    characters: 0,
  });

  const [showOutline, setShowOutline] = useState(true);
  const [layoutMode, setLayoutMode] = useState<WorkspaceLayoutMode>("editor");
  const [mobileTab, setMobileTab] = useState<MobileWorkspaceTab>("editor");
  const [proofLayoutPreference, setProofLayoutPreference] =
    useState<ProofLayoutPreference>("columns");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const isNarrow = useMediaQuery("(max-width: 639px)");
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const editorViewRef = useRef<EditorView | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const loadProject = useCallback(async () => {
    const [projRes, filesRes, collabRes] = await Promise.all([
      fetch(`/api/projects/${projectId}`),
      fetch(`/api/projects/${projectId}/files`),
      fetch(`/api/projects/${projectId}/collab`),
    ]);

    if (projRes.status === 401) {
      router.push("/login");
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
  }, [projectId, router, activeFile]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const saveFile = useCallback(
    async (path: string, content: string, isBinary = false) => {
      if (!canEdit) return;
      await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content, isBinary }),
      });
      setFiles((prev) => {
        const existing = prev.find((f) => f.path === path);
        if (existing) {
          return prev.map((f) =>
            f.path === path ? { ...f, content, isBinary } : f
          );
        }
        return [...prev, { path, content, isBinary }];
      });
    },
    [projectId, canEdit]
  );

  const handleEditorChange = useCallback(
    (content: string) => {
      if (!activeFile) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveFile(activeFile, content), 1000);
    },
    [activeFile, saveFile]
  );

  async function compile() {
    setCompiling(true);
    setCompileErrors([]);
    openProof();
    setShowLog(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/compile`, { method: "POST" });
      const result = await res.json();
      if (result.error) {
        setCompileLog("");
        setCompileErrors([{ message: result.error, severity: "error" }]);
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
        setCompileErrors(errors);
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
      setCompileErrors([{ message: "Failed to compile", severity: "error" }]);
    } finally {
      setCompiling(false);
    }
  }

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
    if (!confirm(`Delete ${path}?`)) return;
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
    if (!confirm(`Delete folder ${path} and all its contents?`)) return;
    const res = await fetch(
      `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}&recursive=true`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to delete folder");
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
      alert(err.error || "Failed to rename");
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
          }}
          onStatsChange={setDocumentStats}
          jumpToLine={jumpToLine}
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

  const proofPane = (
    <div className="workspace-pane">
      <div className="workspace-pane-header flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-accent" />
        <span>Proof</span>
      </div>
      <PdfPreview
        pdfData={pdfData}
        synctexData={synctexData}
        projectFiles={files.map((f) => f.path)}
        onJumpToLine={handleJumpToLine}
        loading={compiling}
        showDownload
        downloadFilename={project?.name ?? "manuscript"}
        compileFailed={compileErrors.some((e) => e.severity === "error")}
        compileErrors={compileErrors}
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

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen text-ink-muted font-serif">
        Loading manuscript…
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-canvas">
      <header className="h-11 shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 border-b border-border bg-paper/90 backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/dashboard" className="text-ink-faint hover:text-ink transition-colors" title="Back to manuscripts">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setShowOutline(!showOutline)}
            className="text-ink-faint hover:text-ink transition-colors hidden sm:block lg:hidden"
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
          <ThemeToggle compact className="hidden md:inline-flex" />
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
          <Button
            variant={showAi ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowAi(!showAi)}
            className="hidden sm:inline-flex"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI</span>
          </Button>
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory(true)}
              className="hidden sm:inline-flex"
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">History</span>
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="hidden sm:inline-flex"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShare(true)}
            className="hidden sm:inline-flex"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <div className="relative sm:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              aria-expanded={showMobileMenu}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
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
                    className="w-full px-3 py-2 text-left text-sm hover:bg-canvas-dark"
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowShare(true);
                    }}
                  >
                    Share
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-canvas-dark"
                      onClick={() => {
                        setShowMobileMenu(false);
                        setShowHistory(true);
                      }}
                    >
                      History
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-canvas-dark"
                      onClick={() => {
                        setShowMobileMenu(false);
                        setShowSettings(true);
                      }}
                    >
                      Settings
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-canvas-dark"
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowAi(!showAi);
                    }}
                  >
                    AI assistant
                  </button>
                  <div className="border-t border-border my-1" />
                  <div className="px-3 py-2">
                    <ThemeToggle compact />
                  </div>
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
                className="text-ink-faint hover:text-ink p-0.5"
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
            className="hidden lg:flex absolute left-0 top-3 z-10 ml-1 p-1.5 rounded-r-md bg-paper border border-l-0 border-border text-ink-faint hover:text-ink shadow-sm"
            title="Show outline"
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </button>
        )}

        {showOutline && (
          <aside className="hidden sm:flex lg:hidden absolute inset-y-0 left-0 w-64 z-30 bg-paper border-r border-border shadow-lg flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-light">
              <span className="text-xs font-medium tracking-wide uppercase text-ink-faint">Outline</span>
              <button onClick={() => setShowOutline(false)} className="text-ink-faint hover:text-ink p-0.5">
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
          />
          <MobileWorkspaceTabs activeTab={mobileTab} onChange={handleMobileTabChange} />
        </main>

        {showAi && (
          <>
            <div className="absolute inset-0 bg-ink/10 z-20" onClick={() => setShowAi(false)} />
            <aside className="absolute right-0 top-0 bottom-0 w-full sm:w-[380px] z-30 shadow-2xl">
              <AiSidebar
                projectId={projectId}
                activeFile={activeFile}
                selectedText=""
                compileErrors={compileErrors.map((e) => e.message)}
                onInsert={handleInsertAtCursor}
                onClose={() => setShowAi(false)}
              />
            </aside>
          </>
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

      {showSettings && project && (
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
            }
          }}
        />
      )}
    </div>
  );
}
