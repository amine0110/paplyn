import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import express from "express";
import { createHmac } from "crypto";
import postgres from "postgres";
// @ts-expect-error y-websocket utils has no types
import { setupWSConnection, setPersistence } from "y-websocket/bin/utils";
import { createPostgresPersistence } from "./persistence.js";

const PORT = parseInt(process.env.COLLAB_PORT || "1234", 10);
const SECRET = process.env.COLLAB_SECRET || "dev-collab-secret";
const DATABASE_URL = process.env.DATABASE_URL;

function verifyToken(token: string, room: string): boolean {
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

async function initPersistence(): Promise<void> {
  if (!DATABASE_URL) {
    console.warn("[collab] DATABASE_URL not set — Yjs rooms are in-memory only");
    return;
  }

  try {
    const sql = postgres(DATABASE_URL, { max: 5 });
    const persistence = createPostgresPersistence(sql);

    setPersistence({
      bindState: persistence.bindState,
      writeState: persistence.writeState,
      provider: sql,
    });

    console.log("[collab] Yjs persistence enabled (Postgres)");
  } catch (err) {
    console.error("[collab] Failed to initialize Postgres persistence:", err);
  }
}

const app = express();
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "collab", persistence: Boolean(DATABASE_URL) });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const room = url.pathname.slice(1);
  const token = url.searchParams.get("token") || "";

  if (!room || !verifyToken(token, room)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
    setupWSConnection(ws, request, { docName: room, gc: true });
  });
});

await initPersistence();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Collab server listening on port ${PORT}`);
});
