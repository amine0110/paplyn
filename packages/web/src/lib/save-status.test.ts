import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  COLLAB_CONNECTION_LOST_MS,
  COLLAB_SAVE_DEBOUNCE_MS,
  COLLAB_SAVE_MAX_WAIT_MS,
  createSaveStatusTracker,
  getSaveStatusLabel,
  PERSIST_ACK_ORIGIN,
} from "@/lib/save-status";

describe("save status helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes collab-aligned debounce constants", () => {
    expect(COLLAB_SAVE_DEBOUNCE_MS).toBe(2000);
    expect(COLLAB_SAVE_MAX_WAIT_MS).toBe(10000);
    expect(COLLAB_CONNECTION_LOST_MS).toBe(5000);
  });

  it("labels syncing, saving, saved, and failed states", () => {
    expect(getSaveStatusLabel("syncing")).toBe("Syncing…");
    expect(getSaveStatusLabel("saving")).toBe("Saving…");
    expect(getSaveStatusLabel("saved")).toBe("Saved");
    expect(getSaveStatusLabel("failed")).toBe("Save failed");
  });

  it("starts collab trackers as syncing, not saved", () => {
    const changes: string[] = [];
    createSaveStatusTracker((status) => changes.push(status), {
      initialStatus: "syncing",
    });

    expect(changes).toEqual(["syncing"]);
  });

  it("transitions from saved to saving on local doc updates when synced", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      isSynced: () => true,
    });

    tracker.onDocUpdate("local", "remote-provider");

    expect(changes).toEqual(["saved", "saving"]);
  });

  it("ignores remote doc updates", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status));
    const remote = {};

    tracker.onDocUpdate(remote, remote);

    expect(changes).toEqual(["saved"]);
  });

  it("ignores persist-ack origin updates", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      isSynced: () => true,
    });

    tracker.onDocUpdate(PERSIST_ACK_ORIGIN, "remote-provider");

    expect(changes).toEqual(["saved"]);
  });

  it("does not markDirty before initial sync", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      initialStatus: "syncing",
      isSynced: () => false,
    });

    tracker.onDocUpdate("local", "remote-provider");

    expect(changes).toEqual(["syncing"]);
  });

  it("returns to saved only after explicit markSaved", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      isSynced: () => true,
    });

    tracker.onDocUpdate("local", "remote-provider");
    vi.advanceTimersByTime(COLLAB_SAVE_DEBOUNCE_MS);

    expect(changes).toEqual(["saved", "saving"]);

    tracker.markSaved();
    expect(changes).toEqual(["saved", "saving", "saved"]);
  });

  it("marks failed after max wait without persist ack when synced", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      ackTimeoutMs: COLLAB_SAVE_MAX_WAIT_MS,
      isSynced: () => true,
    });

    tracker.onDocUpdate("local", "remote-provider");
    vi.advanceTimersByTime(COLLAB_SAVE_MAX_WAIT_MS - 1);
    expect(changes).toEqual(["saved", "saving"]);

    vi.advanceTimersByTime(1);
    expect(changes).toEqual(["saved", "saving", "failed"]);
  });

  it("onAckTimeout can handle fallback and mark saved without failing", async () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      ackTimeoutMs: COLLAB_SAVE_MAX_WAIT_MS,
      isSynced: () => true,
      onAckTimeout: () => {
        tracker.markSaved();
        return true;
      },
    });

    tracker.onDocUpdate("local", "remote-provider");
    vi.advanceTimersByTime(COLLAB_SAVE_MAX_WAIT_MS);

    expect(changes).toEqual(["saved", "saving", "saved"]);
  });

  it("onAckTimeout returning true skips automatic markFailed", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      ackTimeoutMs: COLLAB_SAVE_MAX_WAIT_MS,
      isSynced: () => true,
      onAckTimeout: () => true,
    });
    tracker.onDocUpdate("local", "remote-provider");
    vi.advanceTimersByTime(COLLAB_SAVE_MAX_WAIT_MS);

    expect(changes).toEqual(["saved", "saving"]);
  });

  it("cancels ack timeout when markSaved arrives in time", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      ackTimeoutMs: COLLAB_SAVE_MAX_WAIT_MS,
      isSynced: () => true,
    });

    tracker.onDocUpdate("local", "remote-provider");
    vi.advanceTimersByTime(COLLAB_SAVE_MAX_WAIT_MS - 1);
    tracker.markSaved();
    vi.advanceTimersByTime(10_000);

    expect(changes).toEqual(["saved", "saving", "saved"]);
  });

  it("markFailed surfaces save failure", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      isSynced: () => true,
    });

    tracker.onDocUpdate("local", "remote-provider");
    tracker.markFailed();

    expect(changes).toEqual(["saved", "saving", "failed"]);
    expect(getSaveStatusLabel("failed")).toBe("Save failed");
  });

  it("does not fail immediately when disconnected at markDirty time", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      isConnected: () => false,
      isSynced: () => true,
    });

    tracker.onDocUpdate("local", "remote-provider");

    expect(changes).toEqual(["saved", "saving"]);
  });

  it("onConnectionLost is a no-op while never synced", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      initialStatus: "syncing",
      isSynced: () => false,
    });

    tracker.onConnectionLost();

    expect(changes).toEqual(["syncing"]);
  });

  it("onConnectionLost does not fail on a single disconnected blip before sync", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      initialStatus: "syncing",
      isSynced: () => false,
      isConnected: () => false,
      connectionLostGraceMs: COLLAB_CONNECTION_LOST_MS,
    });

    tracker.onConnectionLost();
    vi.advanceTimersByTime(COLLAB_CONNECTION_LOST_MS);

    expect(changes).toEqual(["syncing"]);
  });

  it("onConnectionLost fails only after sustained disconnect when synced", () => {
    const changes: string[] = [];
    let connected = true;
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      isSynced: () => true,
      isConnected: () => connected,
      connectionLostGraceMs: COLLAB_CONNECTION_LOST_MS,
    });

    tracker.onSynced();
    tracker.onDocUpdate("local", "remote-provider");
    connected = false;
    tracker.onConnectionLost();

    vi.advanceTimersByTime(COLLAB_CONNECTION_LOST_MS - 1);
    expect(changes).toEqual(["saved", "saving"]);

    vi.advanceTimersByTime(1);
    expect(changes).toEqual(["saved", "saving", "failed"]);
  });

  it("onConnectionRestored cancels sustained disconnect failure", () => {
    const changes: string[] = [];
    let connected = false;
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      isSynced: () => true,
      isConnected: () => connected,
      connectionLostGraceMs: COLLAB_CONNECTION_LOST_MS,
    });

    tracker.onSynced();
    tracker.onDocUpdate("local", "remote-provider");
    tracker.onConnectionLost();
    connected = true;
    tracker.onConnectionRestored();

    vi.advanceTimersByTime(COLLAB_CONNECTION_LOST_MS);

    expect(changes).toEqual(["saved", "saving"]);
  });

  it("onSynced moves syncing to saved", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status), {
      initialStatus: "syncing",
    });

    tracker.onSynced();

    expect(changes).toEqual(["syncing", "saved"]);
  });

  it("onConnectionLost is a no-op when already saved", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status));

    tracker.onConnectionLost();

    expect(changes).toEqual(["saved"]);
  });
});
