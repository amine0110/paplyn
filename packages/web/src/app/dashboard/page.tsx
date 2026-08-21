"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Archive, FileText } from "lucide-react";
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
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    loadProjects();
  }

  const visibleOwned = owned.filter((p) => showArchived || !p.archived);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs tracking-[0.15em] uppercase text-ink-faint mb-1">Your desk</p>
            <h1 className="font-serif text-2xl md:text-3xl font-medium">Manuscripts</h1>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New manuscript
          </Button>
        </div>

        {loading ? (
          <p className="text-ink-muted font-serif">Loading…</p>
        ) : (
          <>
            {visibleOwned.length === 0 && shared.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-sm bg-paper">
                <FileText className="h-8 w-8 text-ink-faint mx-auto mb-4" />
                <p className="text-ink-muted mb-1 font-serif">No manuscripts yet.</p>
                <p className="text-sm text-ink-faint mb-6">Start your first LaTeX document.</p>
                <Button onClick={() => setShowCreate(true)}>New manuscript</Button>
              </div>
            ) : (
              <div className="space-y-8">
                {visibleOwned.length > 0 && (
                  <section>
                    <h2 className="text-xs font-medium tracking-wide uppercase text-ink-faint mb-3">Yours</h2>
                    <div className="space-y-2">
                      {visibleOwned.map((p) => (
                        <ProjectRow key={p.id} project={p} onArchive={archiveProject} />
                      ))}
                    </div>
                  </section>
                )}

                {shared.length > 0 && (
                  <section>
                    <h2 className="text-xs font-medium tracking-wide uppercase text-ink-faint mb-3">Shared with you</h2>
                    <div className="space-y-2">
                      {shared.map((p) => (
                        <Link
                          key={p.id}
                          href={`/project/${p.id}`}
                          className="flex items-center justify-between p-4 rounded-sm border border-border bg-paper hover:border-accent/30 transition-colors group"
                        >
                          <div>
                            <span className="font-serif font-medium group-hover:text-accent transition-colors">{p.name}</span>
                            <span className="text-xs text-ink-faint ml-2 capitalize">{p.memberRole}</span>
                          </div>
                          <span className="text-xs text-ink-faint tabular-nums">
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
                className="text-sm text-ink-muted hover:text-ink mt-8 flex items-center gap-1.5"
              >
                <Archive className="h-3.5 w-3.5" />
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            )}
          </>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 p-4">
          <div className="bg-paper rounded-sm border border-border p-6 w-full max-w-md shadow-lg">
            <h2 className="font-serif text-xl font-medium mb-4">New manuscript</h2>
            <form onSubmit={createProject} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Title</Label>
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
                      className={`p-3 rounded-sm border text-left text-sm transition-colors ${
                        template === t.id
                          ? "border-accent bg-accent/5"
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
                <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  onArchive,
}: {
  project: Project;
  onArchive: (id: string, archived: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-sm border border-border bg-paper hover:border-accent/30 transition-colors group">
      <Link href={`/project/${project.id}`} className="flex-1 min-w-0">
        <span className="font-serif font-medium group-hover:text-accent transition-colors">{project.name}</span>
        {project.archived && <span className="text-xs text-ink-faint ml-2">Archived</span>}
        <span className="text-xs text-ink-faint ml-2">{project.template}</span>
      </Link>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-ink-faint tabular-nums">{new Date(project.updatedAt).toLocaleDateString()}</span>
        <button
          onClick={() => onArchive(project.id, !project.archived)}
          className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink p-1"
          title={project.archived ? "Unarchive" : "Archive"}
        >
          <Archive className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
