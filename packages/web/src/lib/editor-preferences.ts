export const SPELLCHECK_STORAGE_KEY = "quire-spellcheck";

export function readStoredSpellcheckEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(SPELLCHECK_STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // ignore storage errors
  }
  return true;
}

export function persistSpellcheckEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SPELLCHECK_STORAGE_KEY, String(enabled));
  } catch {
    // ignore storage errors
  }
}
