import { createServer } from "node:http";

import { errMessage, sendJson } from "./http-messages.mjs";

/** Bind the Cockpit's browser and local command entry points to its operations. */
export function createCockpitHttpServer({ reservedServer, host, isClosed, remote, assets, openSse, snapshot, operations }) {
  const routes = new Map([
    ["GET /", (_req, res) => assets.serveIndex(res)],
    ["GET /api/devices", (_req, res) => operations.handleDevices(res)],
    ["GET /api/state", (_req, res) => sendJson(res, 200, snapshot())],
    ["GET /api/events", openSse],
    ["POST /api/stream/start", operations.handleStreamStart],
    ["POST /api/ears/start", operations.handleStreamStart],
    ["POST /api/stream/stop", (_req, res) => operations.handleStreamStop(res)],
    ["POST /api/ears/stop", (_req, res) => operations.handleStreamStop(res)],
    ["GET /api/discord/prep", (req, res) => operations.handleDiscordPrep(req, res, "GET")],
    ["POST /api/discord/prep", (req, res) => operations.handleDiscordPrep(req, res, "POST")],
    ["POST /api/discord/catalog", (_req, res) => operations.handleDiscordCatalog(res)],
    ["GET /api/discord/vc", (req, res) => operations.handleDiscordVc(req, res, "GET")],
    ["POST /api/discord/vc", (req, res) => operations.handleDiscordVc(req, res, "POST")],
    ["GET /api/discord/chat", (req, res) => operations.handleDiscordChat(req, res, "GET")],
    ["POST /api/discord/chat", (req, res) => operations.handleDiscordChat(req, res, "POST")],
    ["GET /api/discord/vision-target", (req, res) => operations.handleDiscordVisionTarget(req, res, "GET")],
    ["POST /api/discord/vision-target", (req, res) => operations.handleDiscordVisionTarget(req, res, "POST")],
    ["POST /api/fire", (_req, res) => operations.handleManualFire(res)],
    ["GET /api/windows", (_req, res) => operations.handleWindows(res)],
    ["POST /api/vision-target", operations.handleVisionTarget],
    ["POST /api/vision-fire", operations.handleVisionFire],
    ["GET /api/audio-devices", (_req, res) => operations.handleAudioDevices(res)],
    ["POST /api/audio-device", operations.handleAudioDevice],
    ["POST /api/self-fire", operations.handleSelfFire],
    ["POST /api/barge-in", operations.handleBargeIn],
    ["POST /api/verbosity", operations.handleVerbosity],
    ["POST /api/speak-start", operations.handleSpeakStart],
    ["POST /api/comment-busy", operations.handleCommentBusy],
    ["POST /api/kill", operations.handleKill],
    ["POST /api/role", operations.handleSelectRole],
    ["POST /api/role/edit", (req, res, url) => operations.handleEditRole(req, res, url.pathname)],
    ["POST /api/role/new", (req, res, url) => operations.handleEditRole(req, res, url.pathname)],
    ["POST /api/channel", operations.handleChannel],
    ["POST /api/chat/connect", operations.handleChatConnect],
    ["POST /api/chat/source", operations.handleChatSource],
    ["POST /api/chat/disconnect", (_req, res) => operations.handleChatDisconnect(res)],
    ["POST /api/compact-threshold", operations.handleCompactThreshold],
    ["POST /api/codex-fast", operations.handleCodexFast],
    ["POST /api/memory-record", (_req, res) => operations.handleMemoryRecord(res)]
  ]);

  const server = reservedServer ?? createServer();
  server.on("request", (req, res) => {
    handleRequest(req, res).catch((error) => {
      sendJson(res, 500, { error: `internal error: ${errMessage(error)}` });
    });
  });
  return server;

  async function handleRequest(req, res) {
    if (isClosed()) {
      sendJson(res, 503, { error: "cockpit server is closing." });
      return;
    }
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const pathname = url.pathname;

    if (remote && (pathname.startsWith("/api/remote-venue") || method !== "GET" && pathname === "/api/stream/start")) {
      await handleRemoteRequest(remote, req, res, url);
      return;
    }
    if (remote && method !== "GET") {
      sendJson(res, 409, { error: "この場はローカル操作コマンドで操作してください" });
      return;
    }

    const conversationRoute = pathname.match(/^\/api\/conversation-instructions\/([^/]+)$/);
    if (conversationRoute && (method === "GET" || method === "PUT" || method === "DELETE")) {
      await operations.handleConversationInstruction(req, res, method, conversationRoute);
      return;
    }
    const handler = routes.get(`${method} ${pathname}`);
    if (handler) {
      await handler(req, res, url);
      return;
    }
    if (method === "GET" && await assets.tryServeUiAsset(res, pathname)) return;
    sendJson(res, 404, { error: `not found: ${method} ${pathname}` });
  }
}

/** Remote venue control is restricted to the local CLI's requests for this venue. */
async function handleRemoteRequest(remote, req, res, url) {
  const pathname = url.pathname;
  if (req.headers.host !== `127.0.0.1:${remote.getBoundPort()}` || req.headers.origin != null || req.headers["sec-fetch-site"] != null) {
    return sendJson(res, 403, { error: "ローカル操作コマンドから実行してください" });
  }
  if (req.method === "GET" && pathname === "/api/remote-venue") {
    return sendJson(res, 200, remote.status());
  }
  if (req.method !== "POST" || req.headers["x-soul-venue-id"] !== remote.id) {
    return sendJson(res, 409, { error: "この場の所有IDが一致しません" });
  }
  if (pathname === "/api/stream/start") return remote.start(req, res, url);
  if (pathname === "/api/remote-venue/leave") return remote.leave(res);
  if (pathname === "/api/remote-venue/close") return remote.close(res);
  return sendJson(res, 404, { error: "unknown remote venue operation" });
}
