import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import express from "express";
import postgres from "postgres";
// @ts-expect-error y-websocket utils has no types
import { setupWSConnection, setPersistence } from "y-websocket/bin/utils";
import { createPostgresPersistence } from "./persistence.js";
import { extractCollabToken, verifyCollabToken } from "./auth.js";
import { ReplaceTextError, replaceTextInRoom } from "./replace-text.js";

const PORT = parseInt(process.env.COLLAB_PORT || "1234", 10);
const DATABASE_URL = process.env.DATABASE_URL;

let collabSql: postgres.Sql | null = null;

async function initPersistence(): Promise<void> {
  if (!DATABASE_URL) {
    console.warn("[collab] DATABASE_URL not set — Yjs rooms are in-memory only");
    return;
  }

  try {
    const sql = postgres(DATABASE_URL, { max: 5 });
    collabSql = sql;
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
app.use(express.json({ limit: "32mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "collab", persistence: Boolean(DATABASE_URL) });
});

app.post("/rooms/:roomId/replace-text", async (req, res) => {
  const roomId = req.params.roomId;
  const token = extractCollabToken(
    req.headers.authorization,
    typeof req.query.token === "string" ? req.query.token : undefined,
    typeof req.body?.token === "string" ? req.body.token : undefined
  );

  if (!roomId || !verifyCollabToken(token, roomId)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!collabSql) {
    res.status(503).json({ error: "Persistence not available" });
    return;
  }

  const path = typeof req.body?.path === "string" ? req.body.path : "";
  const content = typeof req.body?.content === "string" ? req.body.content : null;
  if (!path || content === null) {
    res.status(400).json({ error: "path and content are required" });
    return;
  }

  try {
    const result = await replaceTextInRoom(collabSql, roomId, path, content);
    console.log(
      `[collab] replace-text roomId=${roomId} path=${path} length=${content.length} bound=${result.bound} main.tex=${result.mainTexLength}`
    );
    res.json({ ok: true, bound: result.bound, mainTexLength: result.mainTexLength });
  } catch (err) {
    if (err instanceof ReplaceTextError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error(`[collab] replace-text failed for room ${roomId}:`, err);
    res.status(500).json({ error: "Replace failed" });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const room = url.pathname.slice(1);
  const token = url.searchParams.get("token") || "";

  if (!room || !verifyCollabToken(token, room)) {
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
