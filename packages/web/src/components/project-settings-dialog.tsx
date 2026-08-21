"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORTED_COMPILERS, type SupportedCompiler } from "@/lib/project-ops";
import type { Project } from "@/lib/schema";
import { Settings } from "lucide-react";

interface ProjectSettingsDialogProps {
  project: Project;
  open: boolean;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

export function ProjectSettingsDialog({
  project,
  open,
  onClose,
  onSaved,
}: ProjectSettingsDialogProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [mainFile, setMainFile] = useState(project.mainFile);
  const [compiler, setCompiler] = useState<SupportedCompiler>(
    SUPPORTED_COMPILERS.includes(project.compiler as SupportedCompiler)
      ? (project.compiler as SupportedCompiler)
      : "pdflatex"
  );
  const [texFiles, setTexFiles] = useState<string[]>([project.mainFile]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(project.name);
    setDescription(project.description ?? "");
    setMainFile(project.mainFile);
    setCompiler(
      SUPPORTED_COMPILERS.includes(project.compiler as SupportedCompiler)
        ? (project.compiler as SupportedCompiler)
        : "pdflatex"
    );
    setError(null);

    fetch(`/api/projects/${project.id}/files`)
      .then((res) => res.json())
      .then((files: { path: string }[]) => {
        const paths = files.map((f) => f.path).filter((p) => p.endsWith(".tex"));
        setTexFiles(paths.length > 0 ? paths.sort() : [project.mainFile]);
      })
      .catch(() => setTexFiles([project.mainFile]));
  }, [open, project]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description.trim() || null,
        mainFile,
        compiler,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "Failed to save settings");
      setSaving(false);
      return;
    }

    const updated = (await res.json()) as Project;
    onSaved(updated);
    onClose();
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border border-border p-6 w-full max-w-md shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-accent" />
          <h2 className="font-serif text-xl font-semibold">Project settings</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Name</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-description">Description</Label>
            <textarea
              id="settings-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Optional notes about this project"
              className="w-full rounded-md border border-border px-3 py-2 text-sm bg-surface text-ink resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-main-file">Main file</Label>
            <select
              id="settings-main-file"
              value={mainFile}
              onChange={(e) => setMainFile(e.target.value)}
              className="w-full h-9 rounded-md border border-border px-3 text-sm bg-surface text-ink"
            >
              {texFiles.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-compiler">Compiler</Label>
            <select
              id="settings-compiler"
              value={compiler}
              onChange={(e) => setCompiler(e.target.value as SupportedCompiler)}
              className="w-full h-9 rounded-md border border-border px-3 text-sm bg-surface text-ink"
            >
              {SUPPORTED_COMPILERS.map((engine) => (
                <option key={engine} value={engine}>
                  {engine}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
