"use client";

import { useState } from "react";
import { FilePlus, FolderPlus, Trash2, Upload, ChevronRight, ChevronDown, File, Folder, Pencil, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildFileTree, folderPathFromFile, joinPath, normalizePath, type FileTreeNode } from "@/lib/project-files";
import {
  CHROME_DESTRUCTIVE_ICON,
  CHROME_HOVER,
  CHROME_ICON_BTN_SM,
} from "@/lib/chrome-interactive";

export interface FileNode {
  path: string;
  content: string;
  isBinary?: boolean;
}

interface FileTreeProps {
  files: FileNode[];
  activeFile: string | null;
  onSelect: (path: string) => void;
  onCreate: (path: string) => void;
  onCreateFolder: (folderName: string) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onUpload: (files: FileList) => void;
  onDownloadSource?: () => void;
  canEdit: boolean;
}

export function FileTree({
  files,
  activeFile,
  onSelect,
  onCreate,
  onCreateFolder,
  onRename,
  onDelete,
  onDeleteFolder,
  onUpload,
  onDownloadSource,
  canEdit,
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = buildFileTree(files.map((f) => f.path));

  function toggleExpand(path: string) {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
  }

  function handleNewFile() {
    const name = prompt("File name (e.g. section.tex or figures/chart.tex):");
    if (name) onCreate(normalizePath(name));
  }

  function handleNewFolder() {
    const name = prompt("Folder name (e.g. figures):");
    if (name) onCreateFolder(normalizePath(name));
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onUpload(e.target.files);
    e.target.value = "";
  }

  function handleRename(node: FileTreeNode) {
    if (node.isFile) {
      const newPath = prompt("New path (rename or move):", node.path);
      if (!newPath) return;
      const normalized = normalizePath(newPath);
      if (normalized !== node.path) onRename(node.path, normalized);
      return;
    }

    const newName = prompt(`Rename folder "${node.name}" to:`, node.name);
    if (!newName) return;
    const normalizedName = normalizePath(newName);
    if (normalizedName === node.name) return;
    const parent = folderPathFromFile(node.path);
    onRename(node.path, joinPath(parent, normalizedName));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-0.5 px-2 py-1.5 border-b border-border-light">
        {canEdit && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewFile} title="New file">
              <FilePlus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewFolder} title="New folder">
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
            <label>
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Upload">
                <span><Upload className="h-3.5 w-3.5" /></span>
              </Button>
              <input type="file" multiple className="hidden" onChange={handleUpload} accept=".tex,.bib,.cls,.sty,.png,.jpg,.jpeg,.pdf" />
            </label>
          </>
        )}
        {onDownloadSource && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDownloadSource} title="Download source">
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto py-1 text-sm">
        {tree.length === 0 ? (
          <p className="px-3 py-2 text-xs text-ink-faint">No files yet</p>
        ) : (
          renderNodes(tree, 0, expanded, toggleExpand, activeFile, onSelect, onDelete, onDeleteFolder, canEdit, handleRename)
        )}
      </div>
    </div>
  );
}

function renderNodes(
  nodes: FileTreeNode[],
  indent: number,
  expanded: Set<string>,
  toggle: (p: string) => void,
  active: string | null,
  onSelect: (p: string) => void,
  onDelete: (p: string) => void,
  onDeleteFolder: (p: string) => void,
  canEdit: boolean,
  handleRename: (node: FileTreeNode) => void
): React.ReactNode {
  return nodes.map((node) => {
    if (node.isFile) {
      return (
        <div
          key={node.path}
          className={`flex items-center gap-1.5 mx-1 px-2 py-1 rounded-sm cursor-pointer group text-[13px] ${
            active === node.path
              ? "bg-accent/10 text-ink font-medium border-l-2 border-accent pl-[6px]"
              : `${CHROME_HOVER} text-ink-muted border-l-2 border-transparent pl-[6px]`
          }`}
          style={{ paddingLeft: `${indent * 10 + 6}px` }}
          onClick={() => onSelect(node.path)}
        >
          <File className="h-3 w-3 shrink-0 text-ink-faint" />
          <span className="truncate flex-1">{node.name}</span>
          {canEdit && (
            <>
              <button
                className={`opacity-0 group-hover:opacity-100 ${CHROME_ICON_BTN_SM} hover:text-accent`}
                title="Rename or move"
                onClick={(e) => { e.stopPropagation(); handleRename(node); }}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                className={`opacity-0 group-hover:opacity-100 ${CHROME_DESTRUCTIVE_ICON}`}
                title="Delete"
                onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      );
    }

    const isOpen = expanded.has(node.path);
    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 mx-1 px-2 py-1 rounded-sm cursor-pointer ${CHROME_HOVER} text-ink-muted text-[13px] group`}
          style={{ paddingLeft: `${indent * 10 + 6}px` }}
          onClick={() => toggle(node.path)}
        >
          {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          <Folder className="h-3 w-3 shrink-0 text-ink-faint" />
          <span className="truncate flex-1">{node.name}</span>
          {canEdit && (
            <>
              <button
                className={`opacity-0 group-hover:opacity-100 ${CHROME_ICON_BTN_SM} hover:text-accent`}
                title="Rename folder"
                onClick={(e) => { e.stopPropagation(); handleRename(node); }}
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                className={`opacity-0 group-hover:opacity-100 ${CHROME_DESTRUCTIVE_ICON}`}
                title="Delete folder"
                onClick={(e) => { e.stopPropagation(); onDeleteFolder(node.path); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
        {isOpen && renderNodes(node.children, indent + 1, expanded, toggle, active, onSelect, onDelete, onDeleteFolder, canEdit, handleRename)}
      </div>
    );
  });
}
