import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  COLLAB_WS_MAX_BACKOFF_MS,
  collabWebsocketProviderOptions,
} from "./collab-websocket-config";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("collab websocket config", () => {
  it("caps reconnect backoff for y-websocket providers", () => {
    expect(COLLAB_WS_MAX_BACKOFF_MS).toBeGreaterThanOrEqual(2500);
    expect(collabWebsocketProviderOptions("token-abc")).toEqual({
      params: { token: "token-abc" },
      maxBackoffTime: COLLAB_WS_MAX_BACKOFF_MS,
    });
  });
});

describe("collab websocket provider stability (deploy gate)", () => {
  it("latex-editor does not recreate the provider when callback props change", () => {
    const src = readSource("components/latex-editor.tsx");
    expect(src).toContain("onChangeRef");
    expect(src).toContain("onDoiPasteRef");
    expect(src).toContain("onSaveStatusChangeRef");
    expect(src).not.toContain("onSaveStatusChange, onDoiPaste");
    expect(src).toMatch(
      /\}, \[filePath, projectId, collabToken, collabBaseUrl, canEdit, isDark\]\)/
    );
    expect(src).toContain("collabWebsocketProviderOptions");
  });

  it("collab-presence uses shared websocket backoff options", () => {
    const src = readSource("components/collab-presence.tsx");
    expect(src).toContain("collabWebsocketProviderOptions");
    expect(src).not.toMatch(
      /new WebsocketProvider\([\s\S]*params:\s*\{\s*token:\s*collabToken\s*\}/
    );
  });
});
