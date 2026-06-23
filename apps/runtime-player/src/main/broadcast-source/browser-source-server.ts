import { createHash } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import type { AddressInfo, Socket } from "node:net";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerBrowserSourceStageDisplayState,
  RuntimePlayerBrowserSourceClientDiagnostic,
  RuntimePlayerBrowserSourceClientDiagnosticEvent,
  RuntimePlayerBrowserSourceStatus
} from "../../preload/browser-source-status-contract";
import {
  createBrowserSourceRuntimeExportResponse
} from "./browser-source-runtime-export-payload";
import { RuntimePlayerBrowserSourceSession } from "./browser-source-session";
import type {
  BrowserSourceSessionStatusListener,
  BrowserSourceSessionTimers
} from "./browser-source-session";
import { createBrowserSourceStageShellHtml } from "./browser-source-stage-shell";
import {
  browserSourceStageDevAssetRoutePrefix,
  browserSourceStageAssetRoutePrefix,
  readBrowserSourceStageDevAsset,
  readBrowserSourceStageClientAssets,
  readBrowserSourceStageStaticAsset,
  type BrowserSourceStageDevAssetFetch,
  type BrowserSourceStageClientAssets
} from "./browser-source-stage-client-assets";
import { readBrowserSourceClientMessage } from "./browser-source-client-message";
import { createBrowserSourceToken, isBrowserSourceTokenMatch } from "./browser-source-token";
import {
  runtimePlayerBrowserSourceBindAddress,
  runtimePlayerBrowserSourceDefaultPort,
  runtimePlayerBrowserSourceTokenQueryKey
} from "./browser-source-url";
import { BrowserSourceWebSocketConnection } from "./browser-source-websocket-connection";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const CLIENT_DIAGNOSTICS_PATH = "/browser-source/client-diagnostics";
const MAX_CLIENT_DIAGNOSTICS_BODY_BYTES = 4096;
const clientDiagnosticEvents = new Set<RuntimePlayerBrowserSourceClientDiagnosticEvent>([
  "html-inline-boot",
  "module-script-tag-injected",
  "module-entry-started",
  "client-start-called",
  "ws-open-attempt",
  "window-error",
  "unhandled-rejection"
]);

export type RuntimePlayerBrowserSourceServerOptions = {
  readonly port?: number;
  readonly token?: string;
  readonly heartbeatIntervalMs?: number;
  readonly statusNotificationIntervalMs?: number;
  readonly nowIso?: () => string;
  readonly nowMs?: () => number;
  readonly timers?: BrowserSourceSessionTimers;
  readonly stageClientAssets?: (
    tokenQuery: string
  ) => BrowserSourceStageClientAssets;
  readonly stageStaticAssetRendererDirectoryPath?: string;
  readonly rendererServerUrl?: string;
  readonly stageDevAssetFetcher?: BrowserSourceStageDevAssetFetch;
};

export class RuntimePlayerBrowserSourceServer {
  readonly #token: string;
  readonly #port: number;
  readonly #heartbeatIntervalMs: number;
  readonly #stageClientAssets: (
    tokenQuery: string
  ) => BrowserSourceStageClientAssets;
  readonly #stageStaticAssetRendererDirectoryPath: string | undefined;
  readonly #rendererServerUrl: string | undefined;
  readonly #stageDevAssetFetcher: BrowserSourceStageDevAssetFetch | undefined;
  readonly #session: RuntimePlayerBrowserSourceSession;
  #server: ReturnType<typeof createServer> | null = null;
  #heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(options: RuntimePlayerBrowserSourceServerOptions = {}) {
    this.#token = options.token ?? createBrowserSourceToken();
    this.#port = options.port ?? runtimePlayerBrowserSourceDefaultPort;
    this.#heartbeatIntervalMs =
      options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.#rendererServerUrl =
      options.rendererServerUrl ?? process.env.ELECTRON_RENDERER_URL;
    this.#stageDevAssetFetcher = options.stageDevAssetFetcher;
    this.#stageClientAssets = options.stageClientAssets ??
      ((tokenQuery) => {
        return readBrowserSourceStageClientAssets({
          tokenQuery,
          ...(this.#rendererServerUrl === undefined
            ? {}
            : { rendererServerUrl: this.#rendererServerUrl })
        });
      });
    this.#stageStaticAssetRendererDirectoryPath =
      options.stageStaticAssetRendererDirectoryPath;
    this.#session = new RuntimePlayerBrowserSourceSession({
      token: this.#token,
      ...(options.nowIso === undefined ? {} : { nowIso: options.nowIso }),
      ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs }),
      ...(options.timers === undefined ? {} : { timers: options.timers }),
      ...(options.statusNotificationIntervalMs === undefined
        ? {}
        : {
            statusNotificationIntervalMs:
              options.statusNotificationIntervalMs
          })
    });
  }

  get token(): string {
    return this.#token;
  }

  getStatus(): RuntimePlayerBrowserSourceStatus {
    return this.#session.getStatus();
  }

  onStatusChanged(
    listener: BrowserSourceSessionStatusListener
  ): () => void {
    return this.#session.onStatusChanged(listener);
  }

  async start(): Promise<RuntimePlayerBrowserSourceStatus> {
    if (this.#server !== null) {
      return this.#session.getStatus();
    }

    this.#session.markStarting();
    const server = createServer((request, response) => {
      void this.#handleHttpRequest(request, response);
    });
    this.#server = server;
    server.on("upgrade", (request, socket) => {
      this.#handleUpgrade(request, socket as Socket);
    });

    try {
      await listenOnLoopback(server, this.#port).catch(async (error) => {
        if (this.#port > 0 && isAddressInUseError(error)) {
          await listenOnLoopback(server, 0);
          return;
        }

        throw error;
      });
    } catch (error) {
      this.#server = null;
      this.#session.markError(error);
      throw error;
    }

    const address = server.address();
    const port = readListeningPort(address);
    this.#session.markRunning({
      port,
      preferredPort: this.#port
    });
    this.#startHeartbeat();

    return this.#session.getStatus();
  }

  async stop(): Promise<void> {
    this.#stopHeartbeat();
    this.#session.closeClients();

    const server = this.#server;
    this.#server = null;

    if (server !== null) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    this.#session.markStopped();
  }

  publishRuntimeExportLoaded(payload: RuntimeExportLoadedPayload): void {
    this.#session.publishRuntimeExportLoaded(payload);
  }

  clearRuntimeExport(statusLabel?: string): void {
    this.#session.clearRuntimeExport(statusLabel);
  }

  publishLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void {
    this.#session.publishLiveParameterFrame(frame);
  }

  clearLatestFrame(): void {
    this.#session.clearLatestFrame();
  }

  publishStageDisplayState(input: {
    readonly stageWindow: RuntimePlayerBrowserSourceStageDisplayState["stageWindow"];
    readonly stageView: RuntimePlayerBrowserSourceStageDisplayState["stageView"];
  }, options: {
    readonly notify?: "immediate" | "sampled";
  } = {}): void {
    this.#session.publishStageDisplayState(input, options);
  }

  async #handleHttpRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const url = readRequestUrl(request);

    if (url === null) {
      sendJson(response, 401, {
        error: "unauthorized",
        message: "Browser Source token is missing or invalid."
      });
      return;
    }

    if (url.pathname.startsWith(browserSourceStageDevAssetRoutePrefix)) {
      if (request.method !== "GET") {
        sendJson(response, 405, {
          error: "method-not-allowed"
        });
        return;
      }
      await this.#handleDevAssetRequest(url, response);
      return;
    }

    if (url.pathname.startsWith(browserSourceStageAssetRoutePrefix)) {
      if (request.method !== "GET") {
        sendJson(response, 405, {
          error: "method-not-allowed"
        });
        return;
      }
      const asset = readBrowserSourceStageStaticAsset({
        requestPath: url.pathname,
        ...(this.#stageStaticAssetRendererDirectoryPath === undefined
          ? {}
          : {
              rendererDirectoryPath:
                this.#stageStaticAssetRendererDirectoryPath
            })
      });
      if (asset === null) {
        this.#session.markAssetRequest({
          routeKind: "built",
          statusCode: 404,
          statusLabel: "not-found"
        });
        sendJson(response, 404, {
          error: "not-found"
        });
        return;
      }

      this.#session.markAssetRequest({
        routeKind: "built",
        statusCode: 200,
        statusLabel: "served"
      });
      sendStaticAsset(response, 200, asset.contentType, asset.bytes);
      return;
    }

    if (
      !isBrowserSourceTokenMatch(
        url.searchParams.get(runtimePlayerBrowserSourceTokenQueryKey),
        this.#token
      )
    ) {
      if (url.pathname === "/stage") {
        this.#session.markStageRequest({
          statusCode: 401,
          statusLabel: "unauthorized"
        });
      }
      sendJson(response, 401, {
        error: "unauthorized",
        message: "Browser Source token is missing or invalid."
      });
      return;
    }

    if (url.pathname === CLIENT_DIAGNOSTICS_PATH) {
      if (request.method !== "POST") {
        sendJson(response, 405, {
          error: "method-not-allowed"
        });
        return;
      }

      await this.#handleClientDiagnosticsRequest(request, response);
      return;
    }

    if (request.method !== "GET") {
      if (url.pathname === "/stage") {
        this.#session.markStageRequest({
          statusCode: 405,
          statusLabel: "method-not-allowed"
        });
      }
      sendJson(response, 405, {
        error: "method-not-allowed"
      });
      return;
    }

    if (url.pathname === "/stage") {
      this.#session.markStageRequest({
        statusCode: 200,
        statusLabel: "served"
      });
      const stageUrl = this.#session.getStatus().browserSourceUrl;
      const tokenQuery = `?${runtimePlayerBrowserSourceTokenQueryKey}=${
        encodeURIComponent(this.#token)
      }`;
      sendHtml(response, 200, createBrowserSourceStageShellHtml({
        webSocketPath: `/ws${tokenQuery}`,
        runtimeExportStatusPath: `/runtime-export/status${tokenQuery}`,
        runtimeExportPayloadPath: `/runtime-export/payload${tokenQuery}`,
        clientDiagnosticsPath: `${CLIENT_DIAGNOSTICS_PATH}${tokenQuery}`,
        clientAssets: this.#stageClientAssets(tokenQuery)
      }), stageUrl);
      return;
    }

    if (url.pathname === "/runtime-export/status") {
      sendJson(response, 200, this.#session.getStatus().runtimeExport);
      return;
    }

    if (url.pathname === "/runtime-export/payload") {
      sendJson(response, 200, createBrowserSourceRuntimeExportResponse({
        runtimeExportStatus: this.#session.getStatus().runtimeExport,
        stageDisplayState: this.#session.getStageDisplayState(),
        runtimeExport: this.#session.getRuntimeExportPayload()
      }));
      return;
    }

    sendJson(response, 404, {
      error: "not-found"
    });
  }

  async #handleClientDiagnosticsRequest(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const body = await readRequestBody(
      request,
      MAX_CLIENT_DIAGNOSTICS_BODY_BYTES
    );
    if (body === null) {
      sendJson(response, 413, {
        error: "payload-too-large"
      });
      return;
    }

    const diagnostic = readClientDiagnostic(body, this.#token);
    if (diagnostic === null) {
      sendJson(response, 400, {
        error: "bad-request"
      });
      return;
    }

    this.#session.markClientDiagnostic(diagnostic);
    sendJson(response, 200, {
      status: "ok"
    });
  }

  async #handleDevAssetRequest(
    url: URL,
    response: ServerResponse
  ): Promise<void> {
    if (this.#rendererServerUrl === undefined || this.#rendererServerUrl === "") {
      this.#session.markAssetRequest({
        routeKind: "dev",
        statusCode: 404,
        statusLabel: "proxy-unavailable"
      });
      sendJson(response, 404, {
        error: "not-found"
      });
      return;
    }

    try {
      const asset = await readBrowserSourceStageDevAsset({
        requestPath: url.pathname,
        requestSearch: url.search,
        rendererServerUrl: this.#rendererServerUrl,
        ...(this.#stageDevAssetFetcher === undefined
          ? {}
          : { fetcher: this.#stageDevAssetFetcher })
      });

      if (asset === null) {
        this.#session.markAssetRequest({
          routeKind: "dev",
          statusCode: 404,
          statusLabel: "not-found"
        });
        sendJson(response, 404, {
          error: "not-found"
        });
        return;
      }

      this.#session.markAssetRequest({
        routeKind: "dev",
        statusCode: asset.statusCode,
        statusLabel: asset.statusCode >= 200 && asset.statusCode < 300
          ? "served"
          : "upstream-status"
      });
      sendStaticAsset(
        response,
        asset.statusCode,
        asset.contentType,
        asset.bytes
      );
    } catch {
      this.#session.markAssetRequest({
        routeKind: "dev",
        statusCode: 502,
        statusLabel: "proxy-error"
      });
      sendJson(response, 502, {
        error: "bad-gateway"
      });
    }
  }

  #handleUpgrade(request: IncomingMessage, socket: Socket): void {
    const url = readRequestUrl(request);

    if (url === null) {
      this.#session.markWsUpgradeRejected({
        statusCode: 401,
        statusLabel: "Unauthorized",
        reason: "invalid-url"
      });
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    if (url.pathname !== "/ws") {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    const token = url.searchParams.get(runtimePlayerBrowserSourceTokenQueryKey);
    if (!isBrowserSourceTokenMatch(token, this.#token)) {
      this.#session.markWsUpgradeRejected({
        statusCode: 401,
        statusLabel: "Unauthorized",
        reason: token === null || token.length === 0
          ? "missing-token"
          : "invalid-token"
      });
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    const webSocketKey = request.headers["sec-websocket-key"];

    if (typeof webSocketKey !== "string" || webSocketKey.length === 0) {
      this.#session.markWsUpgradeRejected({
        statusCode: 400,
        statusLabel: "Bad Request",
        reason: "missing-websocket-key"
      });
      rejectUpgrade(socket, 400, "Bad Request");
      return;
    }

    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${createWebSocketAccept(webSocketKey)}`,
      "",
      ""
    ].join("\r\n"));

    let clientId = 0;
    const connection = new BrowserSourceWebSocketConnection({
      socket,
      handlers: {
        onTextMessage: (text) => {
          this.#session.handleClientMessage(
            clientId,
            readBrowserSourceClientMessage(text)
          );
        },
        onClose: () => {
          this.#session.removeClient(clientId);
        }
      }
    });
    clientId = this.#session.addClient(connection);
  }

  #startHeartbeat(): void {
    if (this.#heartbeatIntervalMs <= 0 || this.#heartbeatTimer !== null) {
      return;
    }

    this.#heartbeatTimer = setInterval(() => {
      this.#session.broadcastServerHeartbeat();
    }, this.#heartbeatIntervalMs);
    this.#heartbeatTimer.unref();
  }

  #stopHeartbeat(): void {
    if (this.#heartbeatTimer === null) {
      return;
    }

    clearInterval(this.#heartbeatTimer);
    this.#heartbeatTimer = null;
  }
}

function readRequestUrl(request: IncomingMessage): URL | null {
  if (request.url === undefined) {
    return null;
  }

  try {
    return new URL(
      request.url,
      `http://${runtimePlayerBrowserSourceBindAddress}`
    );
  } catch {
    return null;
  }
}

async function readRequestBody(
  request: IncomingMessage,
  maxBytes: number
): Promise<string | null> {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  let isTooLarge = false;

  for await (const chunk of request) {
    const bytes = typeof chunk === "string"
      ? Buffer.from(chunk, "utf8")
      : chunk;
    byteLength += bytes.byteLength;
    if (byteLength > maxBytes) {
      isTooLarge = true;
      continue;
    }
    chunks.push(bytes);
  }

  return isTooLarge ? null : Buffer.concat(chunks).toString("utf8");
}

function readClientDiagnostic(
  body: string,
  token: string
): Omit<RuntimePlayerBrowserSourceClientDiagnostic, "reportedAtIso"> | null {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return null;
  }

  if (!isRecord(value) || !isClientDiagnosticEvent(value.event)) {
    return null;
  }

  return {
    event: value.event,
    message: sanitizeDiagnosticString(value.message, 240, token),
    source: sanitizeDiagnosticString(value.source, 240, token),
    line: readDiagnosticPosition(value.line),
    column: readDiagnosticPosition(value.column)
  };
}

function isClientDiagnosticEvent(
  value: unknown
): value is RuntimePlayerBrowserSourceClientDiagnosticEvent {
  return typeof value === "string" &&
    clientDiagnosticEvents.has(
      value as RuntimePlayerBrowserSourceClientDiagnosticEvent
    );
}

function sanitizeDiagnosticString(
  value: unknown,
  maxLength: number,
  token: string
): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const tokenPattern = new RegExp(
    `((?:[?&]|\\b)${runtimePlayerBrowserSourceTokenQueryKey}=)[^&#\\s"'<>]+`,
    "gi"
  );
  return value
    .replace(tokenPattern, "$1[redacted]")
    .replaceAll(token, "[redacted]")
    .slice(0, maxLength);
}

function readDiagnosticPosition(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload)
  });
  response.end(payload);
}

function sendHtml(
  response: ServerResponse,
  statusCode: number,
  html: string,
  stageUrl: string | null
): void {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(html),
    ...(stageUrl === null ? {} : { "X-Runtime-Player-Stage-Url": stageUrl })
  });
  response.end(html);
}

function sendStaticAsset(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  bytes: Buffer
): void {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Length": bytes.byteLength
  });
  response.end(bytes);
}

function rejectUpgrade(
  socket: Socket,
  statusCode: number,
  statusLabel: string
): void {
  socket.write(`HTTP/1.1 ${statusCode} ${statusLabel}\r\n\r\n`);
  socket.destroy();
}

async function listenOnLoopback(
  server: ReturnType<typeof createServer>,
  port: number
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({
      host: runtimePlayerBrowserSourceBindAddress,
      port
    });
  });
}

function isAddressInUseError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EADDRINUSE"
  );
}

function createWebSocketAccept(webSocketKey: string): string {
  return createHash("sha1")
    .update(`${webSocketKey}${WEBSOCKET_GUID}`)
    .digest("base64");
}

function readListeningPort(address: string | AddressInfo | null): number {
  if (typeof address === "object" && address !== null) {
    return address.port;
  }

  throw new Error("Browser Source server did not expose a TCP port.");
}
