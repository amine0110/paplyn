"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { AiChatMessage } from "@/components/ai-sidebar";

/**
 * Keeps the AI assistant thread on the project page so closing the sidebar
 * (unmount) does not wipe chat history. Resets when navigating to another project.
 */
export function useProjectAiChatThread(projectId: string) {
  const [messages, setMessagesState] = useState<AiChatMessage[]>([]);

  useEffect(() => {
    setMessagesState([]);
  }, [projectId]);

  const setMessages: Dispatch<SetStateAction<AiChatMessage[]>> = useCallback(
    (updater) => {
      setMessagesState((prev) => (typeof updater === "function" ? updater(prev) : updater));
    },
    []
  );

  return { messages, setMessages };
}
