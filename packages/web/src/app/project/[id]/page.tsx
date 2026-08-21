"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { FileTree, type FileNode } from "@/components/file-tree";
import { LatexEditor } from "@/components/latex-editor";
import { PdfPreview } from "@/components/pdf-preview";
import { CompilePanel } from "@/components/compile-panel";
import { AiSidebar } from "@/components/ai-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Play,
  Sparkles,
  Share2,
  ChevronLeft,
  Settings,
  Users,
} from "lucide-react";
import type { EditorView } from "@codemirror/view";
import type { Project } from "@/lib/schema";

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
  const [collabToken, setCollabToken] = useState<string | null>(null);
  const [collabBaseUrl, setCollabBaseUrl] = useState("ws://localhost:1234");

  const [compiling, setCompiling] = useState(false);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [compileLog, setCompileLog] = useState("");
  const [compileErrors, setCompileErrors] = useState<CompileError[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [jumpToLine, setJumpToLine] = useState<number | null>(null);

  const [showAi, setShowAi] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"editor" | "viewer">("editor");

  const editorViewRef = useRef<EditorView | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    setFiles(fileList);
    setCanEdit(collab.canEdit);
    setCollabToken(collab.token);

    const wsUrl = collab.wsUrl || "";
    const match = wsUrl.match(/^(wss?:\/\/[^/]+)/);
    if (match) setCollabBaseUrl(match[1]);

    if (!activeFile && fileList.length > 0) {
      setActiveFile(proj.mainFile || fileList[0].path);
    }
  }, [projectId, router, activeFile]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const saveFile = useCallback(
    async (path: string, content: string) => {
      if (!canEdit) return;
      await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      setFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, content } : f))
      );
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
    try {
      const res = await fetch(`/api/projects/${projectId}/compile`, { method: "POST" });
      const result = await res.json();
      if (result.error) {
        setCompileErrors([{ message: result.error, severity: "error" }]);
      } else {
        setCompileLog(result.log || "");
        setCompileErrors(result.errors || []);
        if (result.success && result.pdf) {
          setPdfData(result.pdf);
        }
      }
    } catch {
      setCompileErrors([{ message: "Failed to compile", severity: "error" }]);
    } finally {
      setCompiling(false);
    }
  }

  async function createFile(path: string) {
    await saveFile(path, "");
    setFiles((prev) => [...prev, { path, content: "" }]);
    setActiveFile(path);
  }

  async function deleteFile(path: string) {
    if (!confirm(`Delete ${path}?`)) return;
    await fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`, {
      method: "DELETE",
    });
    setFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeFile === path) {
      setActiveFile(files.find((f) => f.path !== path)?.path || null);
    }
  }

  async function uploadFiles(fileList: FileList) {
    for (const file of Array.from(fileList)) {
      const isBinary = /\.(png|jpg|jpeg|pdf)$/i.test(file.name);
      let content: string;

      if (isBinary) {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        content = `data:${file.type};base64,${base64}`;
      } else {
        content = await file.text();
      }

      await saveFile(file.name, content);
      setFiles((prev) => {
        const existing = prev.find((f) => f.path === file.name);
        if (existing) return prev.map((f) => (f.path === file.name ? { ...f, content, isBinary } : f));
        return [...prev, { path: file.name, content, isBinary }];
      });
    }
  }

  async function shareProject(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${projectId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shareEmail, role: shareRole }),
    });
    if (res.ok) {
      alert("Invitation sent!");
      setShowShare(false);
      setShareEmail("");
    } else {
      const err = await res.json();
      alert(err.error || "Failed to invite");
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

  const activeFileContent = files.find((f) => f.path === activeFile)?.content || "";

  if (!project) {
    return <div className="flex items-center justify-center h-screen text-ink-muted">Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b border-border bg-surface flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-ink-muted hover:text-ink">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-serif font-medium truncate max-w-xs">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={compile} disabled={compiling}>
            <Play className="h-3.5 w-3.5" />
            {compiling ? "Compiling..." : "Compile"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowAi(!showAi)}>
            <Sparkles className="h-3.5 w-3.5" />
            AI
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowShare(true)}>
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal" className="flex-1">
          <Panel defaultSize={18} minSize={12} maxSize={30}>
            <div className="h-full border-r border-border bg-canvas-dark">
              <div className="px-3 py-2 text-xs font-medium text-ink-muted border-b border-border">Files</div>
              <FileTree
                files={files}
                activeFile={activeFile}
                onSelect={setActiveFile}
                onCreate={createFile}
                onDelete={deleteFile}
                onUpload={uploadFiles}
                canEdit={canEdit}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-navy/30 transition-colors" />

          <Panel defaultSize={showAi ? 42 : 52} minSize={25}>
            <div className="h-full flex flex-col">
              {activeFile ? (
                <>
                  <div className="px-3 py-1.5 text-xs text-ink-faint border-b border-border bg-surface font-mono">
                    {activeFile}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <LatexEditor
                      key={activeFile}
                      filePath={activeFile}
                      projectId={projectId}
                      initialContent={activeFileContent}
                      collabToken={collabToken}
                      collabBaseUrl={collabBaseUrl}
                      canEdit={canEdit}
                      onChange={handleEditorChange}
                      onEditorReady={(view) => { editorViewRef.current = view; }}
                      jumpToLine={jumpToLine}
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-ink-muted">
                  Select a file to edit
                </div>
              )}
              <CompilePanel
                log={compileLog}
                errors={compileErrors}
                onJumpToLine={handleJumpToLine}
                showLog={showLog}
                onToggleLog={() => setShowLog(!showLog)}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-navy/30 transition-colors" />

          <Panel defaultSize={showAi ? 25 : 30} minSize={20}>
            <PdfPreview pdfData={pdfData} loading={compiling} />
          </Panel>

          {showAi && (
            <>
              <PanelResizeHandle className="w-1 bg-border hover:bg-navy/30 transition-colors" />
              <Panel defaultSize={15} minSize={12} maxSize={25}>
                <AiSidebar
                  projectId={projectId}
                  activeFile={activeFile}
                  selectedText=""
                  compileErrors={compileErrors.map((e) => e.message)}
                  onInsert={handleInsertAtCursor}
                  onClose={() => setShowAi(false)}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {showShare && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg border border-border p-6 w-full max-w-md shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-navy" />
              <h2 className="font-serif text-xl font-semibold">Share project</h2>
            </div>
            <form onSubmit={shareProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="share-email">Email address</Label>
                <Input
                  id="share-email"
                  type="email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  required
                  placeholder="colleague@university.edu"
                />
              </div>
              <div className="space-y-2">
                <Label>Permission</Label>
                <select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value as "editor" | "viewer")}
                  className="w-full h-9 rounded-md border border-border px-3 text-sm"
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" onClick={() => setShowShare(false)}>Cancel</Button>
                <Button type="submit">Send invite</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
