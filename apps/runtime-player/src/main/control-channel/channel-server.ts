import { createHash } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import type { AddressInfo, Socket } from "node:net";

import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import {
  runtimePlayerControlChannelProtocolVersion,
  type RuntimePlayerControlChannelRejectionCode
} from "./contract/channel-protocol-contract";
import { dispatchControlChannelRequest } from "./channel-request-dispatch";
import { createControlChannelServerHello } from "./channel-protocol-messages";
import type { RuntimePlayerControlChannelOverlayStore } from "./control-channel-overlay-store";
import { createControlChannelToken, isControlChannelTokenMatch } from "./channel-token";
import { runtimePlayerControlChannelDefaultPort } from "./channel-slot-ports";
import {
  runtimePlayerControlChannelBindAddress,
  runtimePlayerControlChannelPath,
  runtimePlayerControlChannelTokenQueryKey
} from "./channel-url";
import { ControlChannelWebSocketConnection } from "./channel-websocket-connection";

/**
 * The Control Channel WS server (C4 Domain A). Transport core is duplicated from
 * Browser Source (frame codec / connection / token); the session semantics
 * (server.hello → intent.set request → accepted/rejected reply with `replyTo`
 * correlation → overlay write) and the MANUAL open/close lifecycle are new.
 *
 * Lifecycle (前例なし — Browser Source auto-starts; this does NOT):
 *  - starts Closed. Never listens until `open()` is called (Channel ページの
 *    Open Channel コマンド, wired by Domain C).
 *  - `open()`  : start listening (loopback + port fallback). idempotent.
 *  - `close()` : stop listening, disconnect clients, clear overlays.
 *  - state machine: Closed / Open (listening, no client) / Connected (protocol版).
 *
 * On an accepted intent the server writes to the injected overlay store; on
 * client disconnect it clears ALL overlays (切断→全失効, C4 §4). Domain B reads
 * the store's snapshot into the heart tick; Domain C wires open/close + observes
 * `getState()` / `onStateChanged()`.
 */

/**
 * Default TTL window applied when an intent omits `ttlMs` (C4 §4「既定窓」).
 * 1000ms: long enough to bridge sub-second gaps between streaming updates
 * (途絶=既定窓で失効), short enough that a real stall drops to the physiology
 * baseline within ~1s. A hard disconnect clears overlays immediately, so this
 * window only governs stalls that keep the socket open.
 */
export const runtimePlayerControlChannelDefaultWindowMs = 1000;

export type RuntimePlayerControlChannelServerState =
  | { readonly kind: "closed" }
  | { readonly kind: "open"; readonly port: number }
  | {
      readonly kind: "connected";
      readonly port: number;
      readonly protocolVersion: number;
    };

export type RuntimePlayerControlChannelServerStateListener = (
  state: RuntimePlayerControlChannelServerState
) => void;

/**
 * A per-message / per-connection event, surfaced so the Channel bridge (Domain C)
 * can keep a session-only Recent Events log (C4 §1: 受理インテント / 拒否+コード /
 * 接続・切断). `onStateChanged` only reports the Closed/Open/Connected transitions;
 * accept/reject outcomes and connect/disconnect are invisible without this seam.
 * Nothing secret rides here — `slotId` is the public semantic vocabulary, `value`
 * is the number the client itself sent, `code` is an enumerated rejection reason.
 * No token, seed, or raw internal slot is ever included.
 */
export type RuntimePlayerControlChannelServerEvent =
  | { readonly kind: "connected" }
  | { readonly kind: "disconnected" }
  | { readonly kind: "accepted"; readonly slotId: string; readonly value: number }
  | {
      readonly kind: "rejected";
      readonly code: RuntimePlayerControlChannelRejectionCode;
    };

export type RuntimePlayerControlChannelServerEventListener = (
  event: RuntimePlayerControlChannelServerEvent
) => void;

export type RuntimePlayerControlChannelServerOptions = {
  readonly overlayStore: RuntimePlayerControlChannelOverlayStore;
  readonly token?: string;
  readonly port?: number;
  /**
   * The loaded model's current auto-mapping slots (for writability validation).
   * Returns null when no model is loaded → every write is slotNotWritable.
   */
  readonly getCurrentSlots?: () => readonly RuntimePlayerMappingSlot[] | null;
  readonly defaultWindowMs?: number;
  readonly nowMs?: () => number;
};

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export class RuntimePlayerControlChannelServer {
  readonly #token: string;
  readonly #port: number;
  readonly #overlayStore: RuntimePlayerControlChannelOverlayStore;
  readonly #getCurrentSlots: () =>
    readonly RuntimePlayerMappingSlot[] | null;
  readonly #defaultWindowMs: number;
  readonly #nowMs: () => number;
  readonly #connections = new Set<ControlChannelWebSocketConnection>();
  readonly #stateListeners = new Set<
    RuntimePlayerControlChannelServerStateListener
  >();
  readonly #eventListeners = new Set<
    RuntimePlayerControlChannelServerEventListener
  >();
  #server: ReturnType<typeof createServer> | null = null;
  #listeningPort: number | null = null;
  #state: RuntimePlayerControlChannelServerState = { kind: "closed" };

  constructor(options: RuntimePlayerControlChannelServerOptions) {
    this.#token = options.token ?? createControlChannelToken();
    this.#port = options.port ?? runtimePlayerControlChannelDefaultPort;
    this.#overlayStore = options.overlayStore;
    this.#getCurrentSlots = options.getCurrentSlots ?? (() => null);
    this.#defaultWindowMs =
      options.defaultWindowMs ?? runtimePlayerControlChannelDefaultWindowMs;
    this.#nowMs = options.nowMs ?? (() => Date.now());
  }

  get token(): string {
    return this.#token;
  }

  getState(): RuntimePlayerControlChannelServerState {
    return this.#state;
  }

  onStateChanged(
    listener: RuntimePlayerControlChannelServerStateListener
  ): () => void {
    this.#stateListeners.add(listener);
    return () => {
      this.#stateListeners.delete(listener);
    };
  }

  onEvent(
    listener: RuntimePlayerControlChannelServerEventListener
  ): () => void {
    this.#eventListeners.add(listener);
    return () => {
      this.#eventListeners.delete(listener);
    };
  }

  async open(): Promise<RuntimePlayerControlChannelServerState> {
    if (this.#server !== null) {
      return this.#state;
    }

    const server = createServer((request, response) => {
      this.#handleHttpRequest(request, response);
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
      throw error;
    }

    this.#listeningPort = readListeningPort(server.address());
    this.#setState({ kind: "open", port: this.#listeningPort });
    return this.#state;
  }

  async close(): Promise<void> {
    for (const connection of this.#connections) {
      connection.close();
    }
    this.#connections.clear();
    this.#overlayStore.clearAll();

    const server = this.#server;
    this.#server = null;
    this.#listeningPort = null;

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

    this.#setState({ kind: "closed" });
  }

  #handleHttpRequest(_request: IncomingMessage, response: ServerResponse): void {
    // The channel is WebSocket-only; a plain HTTP request has no route.
    const body = JSON.stringify({ error: "not-found" });
    response.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(body)
    });
    response.end(body);
  }

  #handleUpgrade(request: IncomingMessage, socket: Socket): void {
    const url = readRequestUrl(request);

    if (url === null || url.pathname !== runtimePlayerControlChannelPath) {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    const token = url.searchParams.get(
      runtimePlayerControlChannelTokenQueryKey
    );
    if (!isControlChannelTokenMatch(token, this.#token)) {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    const webSocketKey = request.headers["sec-websocket-key"];
    if (typeof webSocketKey !== "string" || webSocketKey.length === 0) {
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

    const connection = new ControlChannelWebSocketConnection({
      socket,
      handlers: {
        onTextMessage: (text) => this.#handleClientMessage(connection, text),
        onClose: () => this.#handleClientClose(connection)
      }
    });
    this.#connections.add(connection);
    connection.send(createControlChannelServerHello());
    this.#emitEvent({ kind: "connected" });
    this.#refreshConnectedState();
  }

  #handleClientMessage(
    connection: ControlChannelWebSocketConnection,
    text: string
  ): void {
    const dispatch = dispatchControlChannelRequest({
      text,
      accepting: this.#server !== null,
      getCurrentSlots: this.#getCurrentSlots,
      receivedAtMs: this.#nowMs(),
      defaultWindowMs: this.#defaultWindowMs
    });

    if (dispatch.kind === "ignore") {
      return;
    }

    if (dispatch.overlay !== undefined) {
      this.#overlayStore.setOverlay(
        dispatch.overlay.slotId,
        dispatch.overlay.value,
        dispatch.overlay.expiresAtMs
      );
      this.#emitEvent({
        kind: "accepted",
        slotId: dispatch.overlay.slotId,
        value: dispatch.overlay.value
      });
    } else if (dispatch.reply.result === "rejected") {
      this.#emitEvent({
        kind: "rejected",
        code: dispatch.reply.error.code
      });
    }

    connection.send(dispatch.reply);
  }

  #handleClientClose(connection: ControlChannelWebSocketConnection): void {
    if (!this.#connections.delete(connection)) {
      return;
    }
    // Disconnect → 全失効 (C4 §4): the体 falls back to the生理 baseline.
    this.#overlayStore.clearAll();
    this.#emitEvent({ kind: "disconnected" });
    this.#refreshConnectedState();
  }

  #refreshConnectedState(): void {
    if (this.#server === null || this.#listeningPort === null) {
      return;
    }

    this.#setState(
      this.#connections.size > 0
        ? {
            kind: "connected",
            port: this.#listeningPort,
            protocolVersion: runtimePlayerControlChannelProtocolVersion
          }
        : { kind: "open", port: this.#listeningPort }
    );
  }

  #setState(state: RuntimePlayerControlChannelServerState): void {
    this.#state = state;
    for (const listener of this.#stateListeners) {
      listener(state);
    }
  }

  #emitEvent(event: RuntimePlayerControlChannelServerEvent): void {
    for (const listener of this.#eventListeners) {
      listener(event);
    }
  }
}

function readRequestUrl(request: IncomingMessage): URL | null {
  if (request.url === undefined) {
    return null;
  }

  try {
    return new URL(
      request.url,
      `http://${runtimePlayerControlChannelBindAddress}`
    );
  } catch {
    return null;
  }
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
      host: runtimePlayerControlChannelBindAddress,
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

  throw new Error("Control Channel server did not expose a TCP port.");
}
