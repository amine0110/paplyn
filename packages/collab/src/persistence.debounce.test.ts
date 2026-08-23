import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type postgres from "postgres";
import Y from "./yjs.js";
import {
  PERSIST_ACK_ORIGIN,
  createPostgresPersistence,
  shouldSchedulePersistFromUpdate,
} from "./persistence.js";

function createBindMockSql(): { sql: postgres.Sql; persistCalls: () => number } {
  let persistCalls = 0;
  const sql = (async (strings: TemplateStringsArray) => {
    const query = strings.join("");
    if (query.includes("INSERT INTO collab_room") || query.includes("ON CONFLICT (room_id)")) {
      persistCalls += 1;
    }
    if (query.includes("SELECT path, content, is_binary") && query.includes("project_file")) {
      return [];
    }
    if (query.includes("SELECT path FROM project_file") && query.includes("is_binary = true")) {
      return [];
    }
    if (query.includes("SELECT path, content FROM project_file") && query.includes("is_binary = false")) {
      return [];
    }
    if (query.includes("SELECT state FROM collab_room")) {
      return [];
    }
    if (query.includes("SELECT updated_at FROM collab_room")) {
      return [];
    }
    return [];
  }) as postgres.Sql;
  return { sql, persistCalls: () => persistCalls };
}

describe("persist debounce origin guard", () => {
  it("shouldSchedulePersistFromUpdate rejects persist-ack origin", () => {
    expect(shouldSchedulePersistFromUpdate(PERSIST_ACK_ORIGIN)).toBe(false);
    expect(shouldSchedulePersistFromUpdate("client-edit")).toBe(true);
    expect(shouldSchedulePersistFromUpdate(null)).toBe(true);
  });

  describe("createPostgresPersistence bindState", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not persist when only persist-ack transactions fire", async () => {
      const { sql, persistCalls } = createBindMockSql();
      const persistence = createPostgresPersistence(sql);
      const doc = new Y.Doc();
      doc.getText("main.tex").insert(0, "\\documentclass{article}");

      await persistence.bindState("room-1", doc);
      expect(persistCalls()).toBe(0);

      doc.transact(() => {
        doc.getMap("_meta").set("persistedAt", Date.now());
      }, PERSIST_ACK_ORIGIN);

      await vi.advanceTimersByTimeAsync(12_000);
      expect(persistCalls()).toBe(0);
    });

    it("persists after a non-persist-ack doc update", async () => {
      const { sql, persistCalls } = createBindMockSql();
      const persistence = createPostgresPersistence(sql);
      const doc = new Y.Doc();
      doc.getText("main.tex").insert(0, "\\documentclass{article}");

      await persistence.bindState("room-2", doc);
      doc.getText("main.tex").insert(0, "% marker\n");

      await vi.advanceTimersByTimeAsync(2_500);
      await vi.runAllTimersAsync();
      expect(persistCalls()).toBeGreaterThan(0);
    });
  });
});
