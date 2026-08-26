"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AiChatMessage } from "@/components/ai-sidebar";

/** In-memory thread cache keyed by project id (survives remounts; cleared on refresh). */
const projectThreads = new Map<string, AiChatMessage[]>();

function getThread(projectId: string): AiChatMessage[] {
  return projectThreads.get(projectId) ?? [];
}

function setThread(projectId: string, messages: AiChatMessage[]): void {
  if (messages.length === 0) {
    projectThreads.delete(projectId);
  } else {
    projectThreads.set(projectId, messages);
  }
}

/** Test-only: clears the in-memory thread cache. */
export function resetProjectAiChatThreadsForTests(): void {
  projectThreads.clear();
}

/**
 * Keeps the AI assistant thread for the active project in a module-level store so
 * closing the sidebar (hide) or remounting the project page does not wipe history.
 * Resets only when navigating to a different project. Full page refresh clears the store.
 */
export function useProjectAiChatThread(projectId: string) {
  const [messages, setMessagesState] = useState<AiChatMessage[]>(() => getThread(projectId));
  const prevProjectIdRef = useRef(projectId);

  useEffect(() => {
    if (prevProjectIdRef.current === projectId) return;
    prevProjectIdRef.current = projectId;
    setMessagesState(getThread(projectId));
  }, [projectId]);

  const setMessages: Dispatch<SetStateAction<AiChatMessage[]>> = useCallback(
    (updater) => {
      setMessagesState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        setThread(projectId, next);
        return next;
      });
    },
    [projectId]
  );

  return { messages, setMessages };
}
