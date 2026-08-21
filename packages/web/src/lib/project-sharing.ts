export type ProjectRole = "owner" | "editor" | "viewer";
export type InviteRole = "editor" | "viewer";

export interface CollabTokenPayload {
  room: string;
  userId: string;
  userName: string;
  exp?: number;
}

export interface PresenceUser {
  clientId: number;
  userId: string;
  name: string;
  color: string;
}

const PRESENCE_COLORS = [
  "#3d8585",
  "#6b2d3a",
  "#4a6fa5",
  "#8a6d3b",
  "#5c4d7a",
  "#2d6a4f",
  "#a65d2e",
  "#7a4a6b",
];

export function roleCanEdit(role: ProjectRole | InviteRole): boolean {
  return role === "owner" || role === "editor";
}

export function canManageSharing(role: ProjectRole): boolean {
  return role === "owner";
}

export function formatMemberRole(role: ProjectRole | InviteRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "editor":
      return "Can edit";
    case "viewer":
      return "Can view";
  }
}

export function buildProjectUrl(appUrl: string, projectId: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/project/${projectId}`;
}

export function buildInviteUrl(appUrl: string, inviteId: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/invite/${inviteId}`;
}

export function parseCollabToken(token: string): CollabTokenPayload | null {
  try {
    const [payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as CollabTokenPayload;
    if (!payload.room || !payload.userId || !payload.userName) return null;
    return payload;
  } catch {
    return null;
  }
}

export function colorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
}

export function dedupePresenceUsers(users: PresenceUser[]): PresenceUser[] {
  const byUserId = new Map<string, PresenceUser>();
  for (const user of users) {
    if (!user.userId || !user.name) continue;
    if (!byUserId.has(user.userId)) {
      byUserId.set(user.userId, user);
    }
  }
  return [...byUserId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy copy
    }
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}
