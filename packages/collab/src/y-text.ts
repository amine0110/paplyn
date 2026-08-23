import Y, { type Text } from "./yjs.js";

/** Meta map written by collab persistence — not a project file. */
export const COLLAB_INTERNAL_PATHS = new Set(["_meta"]);

/**
 * Detect Y.Text shared types without relying on `instanceof` across ESM/CJS Yjs realms.
 * y-websocket loads CJS `yjs` while this package is ESM — constructor checks fail (#438).
 */
export function isYTextLike(value: unknown): value is { toString(): string; length: number } {
  if (value instanceof Y.Text) return true;
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.toString === "function" &&
    typeof candidate.length === "number" &&
    typeof candidate.insert === "function" &&
    typeof candidate.delete === "function"
  );
}

/** Replace all content in a Y.Text without leaving duplicate fragments. */
export function replaceYTextContent(ytext: Text, content: string): void {
  const doc = ytext.doc;
  const apply = () => {
    if (ytext.length > 0) {
      ytext.delete(0, ytext.length);
    }
    if (content.length > 0) {
      ytext.insert(0, content);
    }
  };
  if (doc) {
    doc.transact(apply);
  } else {
    apply();
  }
}
