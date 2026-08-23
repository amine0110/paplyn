import { createHmac } from "crypto";

const SECRET = process.env.COLLAB_SECRET || "dev-collab-secret";

/** Verify an HMAC collab token for the given room (same scheme as WebSocket auth). */
export function verifyCollabToken(token: string, room: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [payloadB64, signature] = parts;
    const expected = createHmac("sha256", SECRET).update(payloadB64).digest("hex");
    if (signature !== expected) return false;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (payload.room !== room) return false;
    if (payload.exp && Date.now() > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

/** Extract collab token from Authorization header, query string, or JSON body. */
export function extractCollabToken(
  authHeader: string | undefined,
  queryToken: string | undefined,
  bodyToken?: string
): string {
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  return queryToken || bodyToken || "";
}
