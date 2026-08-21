import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import express from "express";
import { createHmac } from "crypto";
// @ts-expect-error y-websocket utils has no types
import { setupWSConnection } from "y-websocket/bin/utils";

const PORT = parseInt(process.env.COLLAB_PORT || "1234", 10);
const SECRET = process.env.COLLAB_SECRET || "dev-collab-secret";

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

const app = express();
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "collab" });
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Collab server listening on port ${PORT}`);
});
