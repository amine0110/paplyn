"use client";

import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
  colorForUserId,
  dedupePresenceUsers,
  parseCollabToken,
  type PresenceUser,
} from "@/lib/project-sharing";
import { collabWebsocketProviderOptions } from "@/lib/collab-websocket-config";

interface CollabPresenceProps {
  projectId: string;
  collabToken: string | null;
  collabBaseUrl: string;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function CollabPresence({
  projectId,
  collabToken,
  collabBaseUrl,
  className,
}: CollabPresenceProps) {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!collabToken) return;

    const payload = parseCollabToken(collabToken);
    if (!payload) return;

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(
      collabBaseUrl,
      projectId,
      ydoc,
      collabWebsocketProviderOptions(collabToken)
    );

    const localUser = {
      userId: payload.userId,
      name: payload.userName,
      color: colorForUserId(payload.userId),
    };

    provider.awareness.setLocalStateField("user", localUser);

    function syncPresence() {
      const next: PresenceUser[] = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        const user = state.user as { userId?: string; name?: string; color?: string } | undefined;
        if (!user?.userId || !user.name) return;
        next.push({
          clientId,
          userId: user.userId,
          name: user.name,
          color: user.color || colorForUserId(user.userId),
        });
      });
      setUsers(dedupePresenceUsers(next));
    }

    provider.awareness.on("change", syncPresence);
    syncPresence();

    return () => {
      provider.awareness.off("change", syncPresence);
      provider.destroy();
      ydoc.destroy();
    };
  }, [projectId, collabToken, collabBaseUrl]);

  if (users.length === 0) return null;

  return (
    <div className={className} title={users.map((user) => user.name).join(", ")}>
      <div className="flex items-center -space-x-1.5">
        {users.slice(0, 4).map((user) => (
          <span
            key={user.userId}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper text-[10px] font-medium text-white"
            style={{ backgroundColor: user.color }}
            aria-label={user.name}
          >
            {initials(user.name)}
          </span>
        ))}
        {users.length > 4 && (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-paper bg-canvas-dark px-1 text-[10px] text-ink-muted">
            +{users.length - 4}
          </span>
        )}
      </div>
      <span className="hidden lg:inline text-xs text-ink-faint truncate max-w-[12rem]">
        {users.map((user) => user.name).join(", ")}
      </span>
    </div>
  );
}
