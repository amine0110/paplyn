import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "node:module";
import type postgres from "postgres";
import Y, { YJS_CJS_PATH } from "./yjs.js";
import {
  PERSIST_ACK_FIELD,
  PERSIST_META_MAP,
  encodeDocState,
} from "./persistence.js";
import { ReplaceTextError, assertReplaceablePath, replaceTextInRoom } from "./replace-text.js";

const require = createRequire(import.meta.url);
const Ycjs = require(YJS_CJS_PATH) as typeof import("yjs");

vi.mock("y-websocket/bin/utils", () => ({
  docs: new Map<string, InstanceType<typeof Ycjs.Doc>>(),
}));

import { docs } from "y-websocket/bin/utils";

function createMockSql(options: {
  storedState?: Uint8Array | null;
  textFiles?: Array<{ path: string; content: string }>;
} = {}): postgres.Sql {
  let storedState = options.storedState ?? null;
  const textFiles = new Map((options.textFiles ?? []).map((f) => [f.path, f.content]));

  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("");
    if (query.includes("SELECT state FROM collab_room")) {
      if (!storedState) return [];
      return [{ state: Buffer.from(storedState).toString("base64") }];
    }
    if (query.includes("SELECT path FROM project_file") && query.includes("is_binary = true")) {
      return [];
    }
    if (query.includes("SELECT path, content FROM project_file") && query.includes("is_binary = false")) {
      return [...textFiles.entries()].map(([path, content]) => ({ path, content }));
    }
    if (query.includes("INSERT INTO collab_room")) {
      const encoded = values.find((v) => typeof v === "string" && v.length > 20) as string | undefined;
      if (encoded) {
        storedState = new Uint8Array(Buffer.from(encoded, "base64"));
      }
    }
    if (query.includes("INSERT INTO project_file")) {
      const path = values.find((v) => typeof v === "string" && String(v).endsWith(".tex")) as
        | string
        | undefined;
      const content = values.find((v) => typeof v === "string" && !String(v).endsWith(".tex")) as
        | string
        | undefined;
      if (path && typeof content === "string") {
        textFiles.set(path, content);
      }
    }
    return [];
  }) as postgres.Sql;
  return sql;
}

describe("assertReplaceablePath", () => {
  it("rejects binary extensions", () => {
    expect(() => assertReplaceablePath("output.pdf")).toThrow(ReplaceTextError);
  });

  it("allows tex paths", () => {
    expect(() => assertReplaceablePath("main.tex")).not.toThrow();
  });
});

describe("replaceTextInRoom", () => {
  beforeEach(() => {
    docs.clear();
  });

  it("replaces on a bound live doc and persists", async () => {
    const sql = createMockSql({ textFiles: [{ path: "main.tex", content: "old" }] });
    const boundDoc = new Ycjs.Doc();
    boundDoc.getText("main.tex").insert(0, "old");
    docs.set("room-1", boundDoc);

    const result = await replaceTextInRoom(sql, "room-1", "main.tex", "new content");

    expect(result.bound).toBe(true);
    expect(result.mainTexLength).toBe("new content".length);
    expect(boundDoc.getText("main.tex").toString()).toBe("new content");
  });

  it("loads unbound room from stored state, replaces, and persists", async () => {
    const seedDoc = new Y.Doc();
    seedDoc.getText("main.tex").insert(0, "seed");
    const stored = encodeDocState(seedDoc);
    const sql = createMockSql({ storedState: stored });

    const result = await replaceTextInRoom(sql, "room-2", "main.tex", "replaced");

    expect(result.bound).toBe(false);
    expect(result.mainTexLength).toBe("replaced".length);
    expect(docs.has("room-2")).toBe(false);
  });

  it("signals persist ack on bound doc after replace", async () => {
    const sql = createMockSql();
    const boundDoc = new Ycjs.Doc();
    boundDoc.getText("main.tex").insert(0, "x");
    docs.set("room-3", boundDoc);

    await replaceTextInRoom(sql, "room-3", "main.tex", "ack-test");

    expect(boundDoc.getMap(PERSIST_META_MAP).get(PERSIST_ACK_FIELD)).toBeTypeOf("number");
  });

  it("creates path on empty unbound room", async () => {
    const sql = createMockSql();
    const result = await replaceTextInRoom(sql, "room-4", "main.tex", "\\documentclass{}");
    expect(result.bound).toBe(false);
    expect(result.mainTexLength).toBe("\\documentclass{}".length);
  });
});

describe("replaceTextInRoom large paper", () => {
  beforeEach(() => {
    docs.clear();
  });

  it("handles ~311k char main.tex on bound doc", async () => {
    const large = "x".repeat(311_497);
    const updated = large + "% marker";
    const sql = createMockSql({ textFiles: [{ path: "main.tex", content: large }] });
    const boundDoc = new Ycjs.Doc();
    boundDoc.getText("main.tex").insert(0, large);
    docs.set("room-large", boundDoc);

    const result = await replaceTextInRoom(sql, "room-large", "main.tex", updated);

    expect(result.mainTexLength).toBe(updated.length);
    expect(boundDoc.getText("main.tex").length).toBe(updated.length);
  });
});
