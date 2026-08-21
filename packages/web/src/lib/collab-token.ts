import { createHmac } from "crypto";
import { config } from "./config";

export function createCollabToken(
  room: string,
  userId: string,
  userName: string,
  expiresInMs = 24 * 60 * 60 * 1000
): string {
  const payload = {
    room,
    userId,
    userName,
    exp: Date.now() + expiresInMs,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", config.collabSecret).update(payloadB64).digest("hex");

  return `${payloadB64}.${signature}`;
}

export function getCollabWsUrl(projectId: string, token: string): string {
  const base = config.collabUrl.replace(/\/$/, "");
  return `${base}/${projectId}?token=${encodeURIComponent(token)}`;
}
