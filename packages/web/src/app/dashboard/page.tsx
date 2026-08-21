"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectSettingsDialog } from "@/components/project-settings-dialog";
import { Plus, Archive, FileText, Copy, Settings, Trash2 } from "lucide-react";
import type { Project } from "@/lib/schema";

const TEMPLATES = [
  { id: "blank", name: "Blank Article", desc: "Simple article with sections" },
  { id: "ieee", name: "IEEE Conference", desc: "Two-column conference paper" },
  { id: "thesis", name: "Thesis Chapter", desc: "Report-style chapter" },
  { id: "beamer", name: "Beamer Slides", desc: "Presentation slides" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [owned, setOwned] = useState<Project[]>([]);
  const [shared, setShared] = useState<(Project & { memberRole?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("blank");
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json();
    setOwned(data.owned || []);
    setShared(data.shared || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

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
      alert(err.error || "Failed to create project");
    }
    setCreating(false);
  }

  async function archiveProject(id: string, archived: boolean) {
    const label = archived ? "archive" : "unarchive";
    if (!confirm(`Are you sure you want to ${label} this project?`)) return;

    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || `Failed to ${label} project`);
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
    alert(err.error || "Failed to duplicate project");
  }

  async function deleteProject(id: string, projectName: string) {
    if (
      !confirm(
        `Permanently delete "${projectName}"? This removes all files and cannot be undone.`
      )
    ) {
      return;
    }

    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Failed to delete project");
      return;
    }
    loadProjects();
  }

  function handleSettingsSaved(updated: Project) {
    setOwned((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSettingsProject(null);
  }

  const visibleOwned = owned.filter((p) => showArchived || !p.archived);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-serif text-2xl font-semibold">Projects</h1>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New project
          </Button>
        </div>

        {loading ? (
          <p className="text-ink-muted">Loading...</p>
        ) : (
          <>
            {visibleOwned.length === 0 && shared.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-lg">
                <FileText className="h-10 w-10 text-ink-faint mx-auto mb-4" />
                <p className="text-ink-muted mb-4">No projects yet. Create your first LaTeX document.</p>
                <Button onClick={() => setShowCreate(true)}>New project</Button>
              </div>
            ) : (
              <div className="space-y-6">
                {visibleOwned.length > 0 && (
                  <section>
                    <h2 className="text-sm font-medium text-ink-muted mb-3">Your projects</h2>
                    <div className="space-y-2">
                      {visibleOwned.map((p) => (
                        <ProjectRow
                          key={p.id}
                          project={p}
                          onArchive={archiveProject}
                          onDuplicate={duplicateProject}
                          onDelete={deleteProject}
                          onSettings={setSettingsProject}
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
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-canvas-dark transition-colors"
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
                className="text-sm text-ink-muted hover:text-ink mt-6 flex items-center gap-1"
              >
                <Archive className="h-3 w-3" />
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            )}
          </>
        )}
      </main>

      {showCreate && (
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

      {settingsProject && (
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
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-canvas-dark transition-colors group">
      <Link href={`/project/${project.id}`} className="flex-1 min-w-0">
        <div className="font-medium truncate">{project.name}</div>
        <div className="text-xs text-ink-faint mt-0.5 truncate">
          {project.archived && <span className="mr-2">Archived</span>}
          {project.mainFile} · {project.compiler}
          {project.description && <span className="ml-2">— {project.description}</span>}
        </div>
      </Link>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <span className="text-xs text-ink-faint hidden sm:inline">
          {new Date(project.updatedAt).toLocaleDateString()}
        </span>
        <button
          onClick={() => onSettings(project)}
          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink p-1"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDuplicate(project.id)}
          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink p-1"
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          onClick={() => onArchive(project.id, !project.archived)}
          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink p-1"
          title={project.archived ? "Unarchive" : "Archive"}
        >
          <Archive className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(project.id, project.name)}
          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-error p-1"
          title="Delete permanently"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
