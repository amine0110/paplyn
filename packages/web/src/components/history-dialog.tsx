"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project, ProjectFile } from "@/lib/schema";
import { formatRevisionTimestamp } from "@/lib/format-date";
import type { RevisionListItem } from "@/lib/project-revisions";

interface HistoryDialogProps {
  open: boolean;
  projectId: string;
  canEdit: boolean;
  onClose: () => void;
  onRestored: (payload: { project: Project; files: ProjectFile[]; pdf: string | null }) => void;
}

export function HistoryDialog({
  open,
  projectId,
  canEdit,
  onClose,
  onRestored,
}: HistoryDialogProps) {
  const [revisions, setRevisions] = useState<RevisionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    async function loadRevisions() {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/projects/${projectId}/revisions`);
      if (!res.ok) {
        setError("Could not load version history");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRevisions(data.revisions ?? []);
      setLoading(false);
    }

    loadRevisions();
  }, [open, projectId]);

  if (!open) return null;

  async function handleSaveSnapshot() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: snapshotLabel.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save snapshot");
        return;
      }
      setRevisions((prev) => [data, ...prev]);
      setSnapshotLabel("");
    } catch {
      setError("Failed to save snapshot");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(revision: RevisionListItem) {
    const message = [
      `Restore "${revision.label}"?`,
      "This replaces all project files with the saved snapshot.",
      "Your current files will be overwritten.",
    ].join("\n\n");

    if (!confirm(message)) return;

    setRestoringId(revision.id);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/revisions/${revision.id}/restore`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to restore revision");
        return;
      }
      onRestored({
        project: data.project,
        files: data.files,
        pdf: data.pdf ?? null,
      });
      onClose();
    } catch {
      setError("Failed to restore revision");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg border border-border p-6 w-full max-w-lg shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <History className="h-4 w-4 text-accent" />
          <h2 className="font-serif text-lg font-medium">Version history</h2>
        </div>
        <p className="text-sm text-ink-muted mb-4">
          Snapshots are saved after each successful compile. The last 20 revisions are kept.
        </p>

        {canEdit && (
          <div className="mb-4 space-y-2">
            <Label htmlFor="snapshot-label">Save snapshot</Label>
            <div className="flex gap-2">
              <Input
                id="snapshot-label"
                value={snapshotLabel}
                onChange={(e) => setSnapshotLabel(e.target.value)}
                placeholder="Optional label"
                maxLength={200}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveSnapshot}
                disabled={saving}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex-1 min-h-0 overflow-y-auto border border-border rounded-md divide-y divide-border">
          {loading ? (
            <p className="p-4 text-sm text-ink-muted">Loading history…</p>
          ) : revisions.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">
              No snapshots yet. Compile successfully or save a manual snapshot.
            </p>
          ) : (
            revisions.map((revision) => (
              <div
                key={revision.id}
                className="p-3 flex items-start justify-between gap-3 hover:bg-paper/50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{revision.label}</p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {formatRevisionTimestamp(revision.createdAt)}
                  </p>
                  <p className="text-xs text-ink-faint mt-1">
                    {revision.fileCount} file{revision.fileCount === 1 ? "" : "s"}
                    {revision.hasPdf ? " · PDF saved" : ""}
                    {revision.source === "manual" ? " · Manual" : " · Compile"}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(revision)}
                    disabled={restoringId === revision.id}
                    title="Restore this revision"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {restoringId === revision.id ? "Restoring…" : "Restore"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
