"use client";

import { useState } from "react";
import { FilePlus, FolderPlus, Trash2, Upload, ChevronRight, ChevronDown, File } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  onDelete: (path: string) => void;
  onUpload: (files: FileList) => void;
  canEdit: boolean;
}

export function FileTree({ files, activeFile, onSelect, onCreate, onDelete, onUpload, canEdit }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["/"]));

  const tree = buildTree(files.map((f) => f.path));

  function toggleExpand(path: string) {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
  }

  function handleNewFile() {
    const name = prompt("File name (e.g. section.tex):");
    if (name) onCreate(name);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onUpload(e.target.files);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col h-full">
      {canEdit && (
        <div className="flex gap-1 p-2 border-b border-border">
          <Button variant="ghost" size="icon" onClick={handleNewFile} title="New file">
            <FilePlus className="h-4 w-4" />
          </Button>
          <label>
            <Button variant="ghost" size="icon" asChild title="Upload">
              <span><Upload className="h-4 w-4" /></span>
            </Button>
            <input type="file" multiple className="hidden" onChange={handleUpload} accept=".tex,.bib,.cls,.sty,.png,.jpg,.jpeg,.pdf" />
          </label>
        </div>
      )}
      <div className="flex-1 overflow-auto p-1 text-sm">
        {renderNodes(tree, 0, expanded, toggleExpand, activeFile, onSelect, onDelete, canEdit)}
      </div>
    </div>
  );
}

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const path of paths.sort()) {
    const parts = path.split("/");
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const isFile = i === parts.length - 1;
      let node = current.find((n) => n.name === parts[i]);

      if (!node) {
        node = { name: parts[i], path: currentPath, isFile, children: [] };
        current.push(node);
      }

      if (!isFile) current = node.children;
    }
  }

  return root;
}

function renderNodes(
  nodes: TreeNode[],
  indent: number,
  expanded: Set<string>,
  toggle: (p: string) => void,
  active: string | null,
  onSelect: (p: string) => void,
  onDelete: (p: string) => void,
  canEdit: boolean
): React.ReactNode {
  return nodes.map((node) => {
    if (node.isFile) {
      return (
        <div
          key={node.path}
          className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer group ${
            active === node.path ? "bg-navy/10 text-navy" : "hover:bg-canvas-dark"
          }`}
          style={{ paddingLeft: `${indent * 12 + 8}px` }}
          onClick={() => onSelect(node.path)}
        >
          <File className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span className="truncate flex-1">{node.name}</span>
          {canEdit && (
            <button
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-error"
              onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      );
    }

    const isOpen = expanded.has(node.path);
    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-canvas-dark"
          style={{ paddingLeft: `${indent * 12 + 8}px` }}
          onClick={() => toggle(node.path)}
        >
          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && renderNodes(node.children, indent + 1, expanded, toggle, active, onSelect, onDelete, canEdit)}
      </div>
    );
  });
}
