// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetProjectAiChatThreadsForTests,
  useProjectAiChatThread,
} from "@/lib/use-project-ai-chat-thread";

describe("useProjectAiChatThread", () => {
  beforeEach(() => {
    resetProjectAiChatThreadsForTests();
  });

  it("restores messages after remount with the same projectId", () => {
    const { result, unmount } = renderHook(() => useProjectAiChatThread("project-a"));

    act(() => {
      result.current.setMessages([{ role: "user", content: "hello" }]);
    });

    expect(result.current.messages).toHaveLength(1);
    unmount();

    const { result: remounted } = renderHook(() => useProjectAiChatThread("project-a"));
    expect(remounted.current.messages).toHaveLength(1);
    expect(remounted.current.messages[0]?.content).toBe("hello");
  });

  it("starts empty when switching to a different projectId", () => {
    const { result, rerender } = renderHook(
      ({ id }) => useProjectAiChatThread(id),
      { initialProps: { id: "project-a" } }
    );

    act(() => {
      result.current.setMessages([{ role: "user", content: "for a" }]);
    });

    rerender({ id: "project-b" });

    expect(result.current.messages).toEqual([]);
  });

  it("does not use sessionStorage or localStorage", () => {
    const sessionSpy = vi.spyOn(Storage.prototype, "setItem");
    const localSpy = vi.spyOn(window.localStorage, "setItem");

    const { result } = renderHook(() => useProjectAiChatThread("p1"));
    act(() => {
      result.current.setMessages([{ role: "user", content: "x" }]);
    });

    expect(sessionSpy).not.toHaveBeenCalled();
    expect(localSpy).not.toHaveBeenCalled();

    sessionSpy.mockRestore();
    localSpy.mockRestore();
  });
});
