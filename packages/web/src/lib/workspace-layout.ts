export type WorkspaceLayoutMode = "editor" | "proof" | "columns" | "rows";

export const LAYOUT_STORAGE_KEY = "quire-workspace-layout";
export const PROOF_LAYOUT_STORAGE_KEY = "quire-proof-layout";

/** Last split mode used when opening proof (columns or proof-only). */
export type ProofLayoutPreference = "columns" | "proof";

export function readStoredLayoutMode(): WorkspaceLayoutMode {
  if (typeof window === "undefined") return "editor";
  try {
    const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (stored === "editor" || stored === "proof" || stored === "columns" || stored === "rows") {
      return stored;
    }
  } catch {
    // ignore storage errors
  }
  return "editor";
}

export function persistLayoutMode(mode: WorkspaceLayoutMode): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export function readProofLayoutPreference(): ProofLayoutPreference {
  if (typeof window === "undefined") return "columns";
  try {
    const stored = localStorage.getItem(PROOF_LAYOUT_STORAGE_KEY);
    if (stored === "columns" || stored === "proof") return stored;
  } catch {
    // ignore storage errors
  }
  return "columns";
}

export function persistProofLayoutPreference(mode: ProofLayoutPreference): void {
  try {
    localStorage.setItem(PROOF_LAYOUT_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export function layoutShowsEditor(mode: WorkspaceLayoutMode): boolean {
  return mode === "editor" || mode === "columns" || mode === "rows";
}

export function layoutShowsProof(mode: WorkspaceLayoutMode): boolean {
  return mode === "proof" || mode === "columns" || mode === "rows";
}

export function openProofLayout(lastProofLayout: ProofLayoutPreference): WorkspaceLayoutMode {
  return lastProofLayout === "proof" ? "proof" : "columns";
}
