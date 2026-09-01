"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectSettingsDialog } from "@/components/project-settings-dialog";
import { Plus, Archive, ArchiveRestore, FileText, Copy, Settings, Trash2, Upload, MoreHorizontal, Github } from "lucide-react";
import type { Project } from "@/lib/schema";
import { useUiFeedback } from "@/components/ui-feedback";
import { cn } from "@/components/ui/cn";
import { CHROME_ICON_BTN_MD, CHROME_ICON_BTN_SM, CHROME_LINK, CHROME_MENU_ITEM } from "@/lib/chrome-interactive";
import { leaveForLogin } from "@/lib/auth-redirect";
import { useRequireSession } from "@/lib/use-require-session";

const TEMPLATES = [
  { id: "blank", name: "Blank Article", desc: "Simple article with sections" },
  { id: "ieee", name: "IEEE Conference", desc: "Two-column conference paper" },
  { id: "thesis", name: "Thesis Chapter", desc: "Report-style chapter" },
  { id: "beamer", name: "Beamer Slides", desc: "Presentation slides" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useRequireSession({ loginNext: "/dashboard" });
  const { confirm, notice } = useUiFeedback();
  const [owned, setOwned] = useState<Project[]>([]);
  const [shared, setShared] = useState<(Project & { memberRole?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showGitHubImport, setShowGitHubImport] = useState(false);
  const [name, setName] = useState("");
  const [importName, setImportName] = useState("");
  const [importZip, setImportZip] = useState<File | null>(null);
  const [githubImportName, setGithubImportName] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [template, setTemplate] = useState("blank");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingGitHub, setImportingGitHub] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.status === 401) {
      setOwned([]);
      setShared([]);
      setLoading(false);
      leaveForLogin("/dashboard");
      return;
    }
    const data = await res.json();
    setOwned(data.owned || []);
    setShared(data.shared || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setOwned([]);
      setShared([]);
      setSettingsProject(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated, loadProjects]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, template }),
    });
    if (res.ok) {
      const project = await res.json();
      router.push(`/project/${project.id}`);
    } else {
      const err = await res.json();
      notice({ message: err.error || "Failed to create project", variant: "error" });
    }
    setCreating(false);
  }

  async function importProject(e: React.FormEvent) {
    e.preventDefault();
    if (!importZip) {
      notice("Choose a .zip file to import");
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append("name", importName);
    formData.append("zip", importZip);

    const res = await fetch("/api/projects/import", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const project = await res.json();
      router.push(`/project/${project.id}`);
    } else {
      const err = await res.json();
      notice({ message: err.error || "Failed to import project", variant: "error" });
    }
    setImporting(false);
  }

  function openImportDialog() {
    setImportName("");
    setImportZip(null);
    setShowImport(true);
  }

  function openGitHubImportDialog() {
    setGithubImportName("");
    setGithubRepo("");
    setShowGitHubImport(true);
  }

  async function importGitHubProject(e: React.FormEvent) {
    e.preventDefault();
    if (!githubRepo.trim()) {
      notice("Enter a GitHub owner/repo or URL");
      return;
    }

    setImportingGitHub(true);
    const res = await fetch("/api/projects/import-github", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: githubImportName, repo: githubRepo }),
    });

    if (res.ok) {
      const project = await res.json();
      router.push(`/project/${project.id}`);
    } else {
      const err = await res.json();
      notice({ message: err.error || "Failed to import GitHub repository", variant: "error" });
    }
    setImportingGitHub(false);
  }

  function handleGitHubRepoChange(value: string) {
    setGithubRepo(value);
    if (!githubImportName.trim()) {
      const parsed = value.trim().match(/github\.com\/[^/]+\/([^/\s#?]+)/i);
      const slug = parsed?.[1]?.replace(/\.git$/i, "");
      if (slug) setGithubImportName(slug);
      else if (value.includes("/") && !value.includes("://")) {
        setGithubImportName(value.split("/").pop()?.replace(/\.git$/i, "") ?? "");
      }
    }
  }

  function handleImportZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImportZip(file);
    if (file && !importName.trim()) {
      const base = file.name.replace(/\.zip$/i, "").trim();
      if (base) setImportName(base);
    }
    e.target.value = "";
  }

  async function archiveProject(id: string, archived: boolean) {
    const label = archived ? "archive" : "unarchive";
    const ok = await confirm(`Are you sure you want to ${label} this project?`);
    if (!ok) return;

    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) {
      const err = await res.json();
      notice({ message: err.error || `Failed to ${label} project`, variant: "error" });
      return;
    }
    loadProjects();
  }

  async function duplicateProject(id: string) {
    const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
    if (res.ok) {
      const project = await res.json();
      router.push(`/project/${project.id}`);
      return;
    }
    const err = await res.json();
    notice({ message: err.error || "Failed to duplicate project", variant: "error" });
  }

  async function deleteProject(id: string, projectName: string) {
    const ok = await confirm({
      message: `Permanently delete "${projectName}"? This removes all files and cannot be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      notice({ message: err.error || "Failed to delete project", variant: "error" });
      return;
    }
    loadProjects();
  }

  function handleSettingsSaved(updated: Project) {
    setOwned((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSettingsProject(null);
  }

  function openProjectSettings(project: Project) {
    if (!isAuthenticated) {
      leaveForLogin("/dashboard");
      return;
    }
    setSettingsProject(project);
  }

  const activeOwned = owned.filter((p) => !p.archived);
  const archivedOwned = owned.filter((p) => p.archived);
  const hasProjectLists =
    activeOwned.length > 0 ||
    (showArchived && archivedOwned.length > 0) ||
    shared.length > 0;

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {!isAuthenticated ? (
          <p className="text-ink-muted">Loading...</p>
        ) : (
          <>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <h1 className="font-serif text-2xl font-semibold shrink-0">Projects</h1>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={openGitHubImportDialog}
              aria-label="Import GitHub"
              className="h-9 w-9 px-0 sm:w-auto sm:px-4"
            >
              <Github className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Import GitHub</span>
            </Button>
            <Button
              variant="outline"
              onClick={openImportDialog}
              aria-label="Import zip"
              className="h-9 w-9 px-0 sm:w-auto sm:px-4"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Import zip</span>
            </Button>
            <Button
              onClick={() => setShowCreate(true)}
              aria-label="New project"
              className="h-9 w-9 px-0 sm:w-auto sm:px-4"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">New project</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-ink-muted">Loading...</p>
        ) : (
          <>
            {!hasProjectLists ? (
              <div className="text-center py-16 border border-dashed border-border rounded-lg">
                <FileText className="h-10 w-10 text-ink-faint mx-auto mb-4" />
                <p className="text-ink-muted mb-4">No projects yet. Create your first LaTeX document.</p>
                <Button onClick={() => setShowCreate(true)}>New project</Button>
              </div>
            ) : (
              <div className="space-y-6">
                {activeOwned.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-ink-muted mb-3">Your projects</h2>
                    <div className="space-y-2">
                      {activeOwned.map((p) => (
                        <ProjectRow
                          key={p.id}
                          project={p}
                          onArchive={archiveProject}
                          onDuplicate={duplicateProject}
                          onDelete={deleteProject}
                          onSettings={openProjectSettings}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {showArchived && archivedOwned.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-ink-muted mb-3">Archived</h2>
                    <div className="space-y-2">
                      {archivedOwned.map((p) => (
                        <ProjectRow
                          key={p.id}
                          project={p}
                          onArchive={archiveProject}
                          onDuplicate={duplicateProject}
                          onDelete={deleteProject}
                          onSettings={openProjectSettings}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {shared.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-ink-muted mb-3">Shared with you</h2>
                    <div className="space-y-2">
                      {shared.map((p) => (
                        <Link
                          key={p.id}
                          href={`/project/${p.id}`}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-canvas-dark transition-colors",
                            CHROME_LINK
                          )}
                        >
                          <div>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-xs text-ink-faint ml-2 capitalize">{p.memberRole}</span>
                            <span className="text-xs text-ink-faint ml-2">
                              {p.mainFile} · {p.compiler}
                            </span>
                          </div>
                          <span className="text-xs text-ink-faint">
                            {new Date(p.updatedAt).toLocaleDateString()}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {owned.some((p) => p.archived) && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={cn("text-sm mt-6 flex items-center gap-1", CHROME_LINK)}
              >
                <Archive className="h-3 w-3" />
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            )}
          </>
        )}
          </>
        )}
      </main>

      {isAuthenticated && showGitHubImport && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg border border-border p-6 w-full max-w-md shadow-lg">
            <h2 className="font-serif text-xl font-semibold mb-4">Import from GitHub</h2>
            <p className="text-sm text-ink-muted mb-4">
              Open a public repository with .tex, .bib, and figure files. Private repos are not supported.
            </p>
            <form onSubmit={importGitHubProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="github-repo">Repository</Label>
                <Input
                  id="github-repo"
                  value={githubRepo}
                  onChange={(e) => handleGitHubRepoChange(e.target.value)}
                  required
                  placeholder="owner/repo or https://github.com/owner/repo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="github-import-name">Project name</Label>
                <Input
                  id="github-import-name"
                  value={githubImportName}
                  onChange={(e) => setGithubImportName(e.target.value)}
                  required
                  placeholder="My Paper"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowGitHubImport(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={importingGitHub}>
                  {importingGitHub ? "Importing..." : "Import"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAuthenticated && showImport && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg border border-border p-6 w-full max-w-md shadow-lg">
            <h2 className="font-serif text-xl font-semibold mb-4">Import from zip</h2>
            <p className="text-sm text-ink-muted mb-4">
              Upload an Overleaf-style zip with .tex, .bib, and image files.
            </p>
            <form onSubmit={importProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-name">Project name</Label>
                <Input
                  id="import-name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  required
                  placeholder="Imported Paper"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-zip">Zip archive</Label>
                <Input
                  id="import-zip"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={handleImportZipChange}
                />
                {importZip && (
                  <p className="text-xs text-ink-faint">{importZip.name}</p>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowImport(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={importing || !importZip}>
                  {importing ? "Importing..." : "Import"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAuthenticated && showCreate && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg border border-border p-6 w-full max-w-md shadow-lg">
            <h2 className="font-serif text-xl font-semibold mb-4">New project</h2>
            <form onSubmit={createProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="My Paper" />
              </div>
              <div className="space-y-2">
                <Label>Template</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplate(t.id)}
                      className={`p-3 rounded-md border text-left text-sm transition-colors ${
                        template === t.id
                          ? "border-navy bg-navy/5"
                          : "border-border hover:bg-canvas-dark"
                      }`}
                    >
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-ink-faint mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAuthenticated && settingsProject && (
        <ProjectSettingsDialog
          project={settingsProject}
          open={!!settingsProject}
          onClose={() => setSettingsProject(null)}
          onSaved={handleSettingsSaved}
        />
      )}
    </div>
  );
}

function ProjectRow({
  project,
  onArchive,
  onDuplicate,
  onDelete,
  onSettings,
}: {
  project: Project;
  onArchive: (id: string, archived: boolean) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onSettings: (project: Project) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function runMenuAction(action: () => void) {
    setMenuOpen(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => action());
    });
  }

  const archiveLabel = project.archived ? "Unarchive" : "Archive";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-canvas-dark transition-colors group">
      <Link href={`/project/${project.id}`} className={cn("flex-1 min-w-0", CHROME_LINK)}>
        <div className="font-medium truncate">{project.name}</div>
        <div className="text-xs text-ink-faint mt-0.5 truncate">
          {project.archived && <span className="mr-2">Archived</span>}
          {project.mainFile} · {project.compiler}
          {project.description && <span className="ml-2">— {project.description}</span>}
        </div>
      </Link>
      <div className="hidden md:flex items-center gap-1 shrink-0 ml-2">
        <span className="text-xs text-ink-faint hidden lg:inline">
          {new Date(project.updatedAt).toLocaleDateString()}
        </span>
        <button
          onClick={() => onSettings(project)}
          className={cn(
            CHROME_ICON_BTN_SM,
            "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto text-ink-faint hover:text-ink"
          )}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDuplicate(project.id)}
          className={cn(
            CHROME_ICON_BTN_SM,
            "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto text-ink-faint hover:text-ink"
          )}
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={() => onArchive(project.id, !project.archived)}
          className={cn(
            CHROME_ICON_BTN_SM,
            "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto text-ink-faint hover:text-ink"
          )}
          title={archiveLabel}
          aria-label={archiveLabel}
        >
          {project.archived ? (
            <ArchiveRestore className="h-4 w-4" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => onDelete(project.id, project.name)}
          className={cn(
            CHROME_ICON_BTN_SM,
            "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto text-ink-faint hover:text-error"
          )}
          title="Delete permanently"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="relative md:hidden shrink-0 ml-1">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          className={cn(
            CHROME_ICON_BTN_MD,
            "flex h-11 w-11 items-center justify-center text-ink-faint hover:text-ink"
          )}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Project actions"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div
              className="absolute right-0 top-full mt-1 z-50 min-w-[10rem] rounded-sm border border-border bg-paper py-1 shadow-lg"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className={cn(CHROME_MENU_ITEM, "flex w-full items-center gap-2 px-3 py-2.5 text-sm")}
                onClick={() => runMenuAction(() => onSettings(project))}
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button
                type="button"
                role="menuitem"
                className={cn(CHROME_MENU_ITEM, "flex w-full items-center gap-2 px-3 py-2.5 text-sm")}
                onClick={() => runMenuAction(() => onDuplicate(project.id))}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                className={cn(CHROME_MENU_ITEM, "flex w-full items-center gap-2 px-3 py-2.5 text-sm")}
                onClick={() => runMenuAction(() => onArchive(project.id, !project.archived))}
              >
                {project.archived ? (
                  <ArchiveRestore className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                {archiveLabel}
              </button>
              <button
                type="button"
                role="menuitem"
                className={cn(CHROME_MENU_ITEM, "flex w-full items-center gap-2 px-3 py-2.5 text-sm text-error")}
                onClick={() => runMenuAction(() => onDelete(project.id, project.name))}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
