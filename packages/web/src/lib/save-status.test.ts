import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  COLLAB_SAVE_DEBOUNCE_MS,
  COLLAB_SAVE_MAX_WAIT_MS,
  createSaveStatusTracker,
  getSaveStatusLabel,
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
  });

  it("labels saving, saved, and failed states", () => {
    expect(getSaveStatusLabel("saving")).toBe("Saving…");
    expect(getSaveStatusLabel("saved")).toBe("Saved");
    expect(getSaveStatusLabel("failed")).toBe("Save failed");
  });

  it("transitions from saved to saving on local doc updates", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status));

    tracker.onDocUpdate("local", "remote-provider");

    expect(changes).toEqual(["saving"]);
  });

  it("ignores remote doc updates", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status));
    const remote = {};

    tracker.onDocUpdate(remote, remote);

    expect(changes).toEqual([]);
  });

  it("returns to saved only after explicit markSaved", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status));

    tracker.onDocUpdate("local", "remote-provider");
    vi.advanceTimersByTime(COLLAB_SAVE_DEBOUNCE_MS);

    expect(changes).toEqual(["saving"]);

    tracker.markSaved();
    expect(changes).toEqual(["saving", "saved"]);
  });

  it("does not auto-save after debounce without markSaved", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status));

    tracker.onDocUpdate("local", "remote-provider");
    vi.advanceTimersByTime(COLLAB_SAVE_MAX_WAIT_MS);

    expect(changes).toEqual(["saving"]);
  });

  it("markFailed surfaces save failure", () => {
    const changes: string[] = [];
    const tracker = createSaveStatusTracker((status) => changes.push(status));

    tracker.onDocUpdate("local", "remote-provider");
    tracker.markFailed();

    expect(changes).toEqual(["saving", "failed"]);
    expect(getSaveStatusLabel("failed")).toBe("Save failed");
  });
});
