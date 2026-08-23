/** Human-readable live status for AI tool calls (sidebar progress). */

function basename(path: string): string {
  const normalized = path.replace(/^\.\//, "").trim();
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

function formatLineRange(startLine: number, endLine: number): string {
  if (startLine === endLine) return `line ${startLine}`;
  return `lines ${startLine}–${endLine}`;
}

export function formatToolProgressStart(
  toolName: string,
  args: Record<string, unknown>
): string | null {
  switch (toolName) {
    case "get_file": {
      const path = typeof args.path === "string" ? basename(args.path) : "file";
      const startLine = typeof args.startLine === "number" ? args.startLine : null;
      const endLine = typeof args.endLine === "number" ? args.endLine : null;
      if (startLine != null && endLine != null) {
        return `Reading ${path} (${formatLineRange(startLine, endLine)})…`;
      }
      return `Reading ${path}…`;
    }
    case "list_files":
      return "Listing project files…";
    case "replace_lines": {
      const file = typeof args.file === "string" ? basename(args.file) : "file";
      const startLine = typeof args.startLine === "number" ? args.startLine : null;
      const endLine = typeof args.endLine === "number" ? args.endLine : null;
      if (startLine != null && endLine != null) {
        return `Replacing ${formatLineRange(startLine, endLine)} in ${file}…`;
      }
      return `Replacing lines in ${file}…`;
    }
    case "apply_edit": {
      const file = typeof args.file === "string" ? basename(args.file) : "file";
      return `Editing ${file}…`;
    }
    case "fix_compile_errors":
      return "Applying compile fixes…";
    case "insert_at_cursor":
      return "Inserting at cursor…";
    case "replace_selection":
      return "Replacing selection…";
    case "search_literature":
      return "Searching literature…";
    default:
      return null;
  }
}

export function formatToolProgressDone(
  toolName: string,
  result: unknown
): string | null {
  if (result == null) return null;

  if (
    typeof result === "object" &&
    result !== null &&
    (result as { kind?: string }).kind === "client-action"
  ) {
    const action = (result as { action?: { label?: string } }).action;
    if (action?.label) return action.label;
  }

  if (
    typeof result === "object" &&
    result !== null &&
    (result as { kind?: string }).kind === "client-action-rejected"
  ) {
    if (toolName === "apply_edit" || toolName === "replace_lines" || toolName === "fix_compile_errors") {
      return "Edit could not be applied";
    }
    return "Action could not be completed";
  }

  if (toolName === "get_file" && typeof result === "object" && result !== null) {
    const read = result as {
      path?: string;
      startLine?: number;
      endLine?: number;
      error?: string;
    };
    if (read.error) {
      const file = read.path ? basename(read.path) : "file";
      return `Couldn't read ${file}`;
    }
    if (read.path && read.startLine != null && read.endLine != null) {
      return `Read ${basename(read.path)} (${formatLineRange(read.startLine, read.endLine)})`;
    }
  }

  if (toolName === "list_files" && typeof result === "object" && result !== null) {
    const listed = result as { count?: number; error?: string };
    if (listed.error) return "Couldn't list project files";
    if (listed.count != null) return `Listed ${listed.count} project file(s)`;
  }

  return null;
}
