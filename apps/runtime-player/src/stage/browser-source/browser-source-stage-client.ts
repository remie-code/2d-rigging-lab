import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import {
  type RuntimePlayerBrowserSourceClientMessage,
  type RuntimePlayerBrowserSourceRuntimeExportPayload
} from "../../preload/browser-source-transport-contract";
import type {
  RuntimePlayerBrowserSourceStageDisplayState
} from "../../preload/browser-source-status-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  createBrowserSourceHttpUrl,
  createBrowserSourceWebSocketUrl,
  type BrowserSourceLocation,
  type BrowserSourcePageConfig
} from "./browser-source-page-config";
import {
  reportBrowserSourceClientDiagnostic,
  type BrowserSourceClientDiagnosticReporter
} from "./browser-source-client-diagnostics";
import { BrowserSourceRenderMetrics } from "./browser-source-render-metrics";
import { toRuntimeExportLoadedPayload } from "./browser-source-runtime-export-adapter";
import {
  readBrowserSourceRuntimeExportResponse,
  readBrowserSourceServerMessage
} from "./browser-source-server-message";
import type { BrowserSourceStageRenderer } from "./browser-source-stage-renderer";

export type BrowserSourceStageNetworkStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type BrowserSourceStageRenderStatus =
  | "idle"
  | "loading"
  | "rendering"
  | "error";

export type BrowserSourceStageClientSnapshot = {
  readonly connectionStatus: BrowserSourceStageNetworkStatus;
  readonly webgl2Available: "available" | "unavailable" | "unknown";
  readonly runtimeExportLoaded: boolean;
  readonly runtimeExportApplyCount: number;
  readonly renderStatus: BrowserSourceStageRenderStatus;
  readonly message: string | null;
  readonly fps: number | null;
  readonly frameAgeMs: number | null;
};

export type BrowserSourceStageClientListener = (
  snapshot: BrowserSourceStageClientSnapshot
) => void;

export type BrowserSourceStageClientFetch = (
  url: string
) => Promise<{
  readonly ok: boolean;
  json(): Promise<unknown>;
}>;

export type BrowserSourceWebSocketEventMap = {
  readonly open: Event;
  readonly close: Event;
  readonly error: Event;
  readonly message: MessageEvent;
};

export interface BrowserSourceWebSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener<TKey extends keyof BrowserSourceWebSocketEventMap>(
    type: TKey,
    listener: (event: BrowserSourceWebSocketEventMap[TKey]) => void
  ): void;
  removeEventListener<TKey extends keyof BrowserSourceWebSocketEventMap>(
    type: TKey,
    listener: (event: BrowserSourceWebSocketEventMap[TKey]) => void
  ): void;
}

export type BrowserSourceWebSocketFactory = (
  url: string
) => BrowserSourceWebSocketLike;

export type BrowserSourceTimerHandle =
  | number
  | ReturnType<typeof globalThis.setTimeout>;

export type BrowserSourceStageClientTimers = {
  readonly setTimeout: (
    callback: () => void,
    delayMs: number
  ) => BrowserSourceTimerHandle;
  readonly clearTimeout: (handle: BrowserSourceTimerHandle) => void;
  readonly setInterval: (
    callback: () => void,
    delayMs: number
  ) => BrowserSourceTimerHandle;
  readonly clearInterval: (handle: BrowserSourceTimerHandle) => void;
};

export type BrowserSourceStageClientOptions = {
  readonly config: BrowserSourcePageConfig;
  readonly renderer: BrowserSourceStageRenderer | null;
  readonly webgl2Available: "available" | "unavailable" | "unknown";
  readonly initialMessage?: string | null;
  readonly fetcher?: BrowserSourceStageClientFetch;
  readonly webSocketFactory?: BrowserSourceWebSocketFactory;
  readonly location?: BrowserSourceLocation;
  readonly timers?: BrowserSourceStageClientTimers;
  readonly diagnosticReporter?: BrowserSourceClientDiagnosticReporter;
  readonly nowIso?: () => string;
  readonly nowMs?: () => number;
  readonly reconnectDelayMs?: number;
  readonly heartbeatIntervalMs?: number;
  readonly diagnosticIntervalMs?: number;
};

const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
const DEFAULT_DIAGNOSTIC_INTERVAL_MS = 500;

export class BrowserSourceStageClient {
  readonly #config: BrowserSourcePageConfig;
  readonly #renderer: BrowserSourceStageRenderer | null;
  readonly #fetcher: BrowserSourceStageClientFetch;
  readonly #webSocketFactory: BrowserSourceWebSocketFactory;
  readonly #location: BrowserSourceLocation;
  readonly #timers: BrowserSourceStageClientTimers;
  readonly #diagnosticReporter: BrowserSourceClientDiagnosticReporter;
  readonly #nowIso: () => string;
  readonly #nowMs: () => number;
  readonly #reconnectDelayMs: number;
  readonly #heartbeatIntervalMs: number;
  readonly #diagnosticIntervalMs: number;
  readonly #metrics = new BrowserSourceRenderMetrics();
  readonly #listeners = new Set<BrowserSourceStageClientListener>();
  #socket: BrowserSourceWebSocketLike | null = null;
  #reconnectTimer: BrowserSourceTimerHandle | null = null;
  #heartbeatTimer: BrowserSourceTimerHandle | null = null;
  #diagnosticsTimer: BrowserSourceTimerHandle | null = null;
  #lastDiagnosticsSentAtMs: number | null = null;
  #runtimeExportPayloadKey: string | null = null;
  #activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null =
    null;
  #runtimeExportApplyCount = 0;
  #started = false;
  #snapshot: BrowserSourceStageClientSnapshot;

  constructor(options: BrowserSourceStageClientOptions) {
    this.#config = options.config;
    this.#renderer = options.renderer;
    this.#fetcher = options.fetcher ?? defaultFetch;
    this.#webSocketFactory = options.webSocketFactory ?? defaultWebSocketFactory;
    this.#location = options.location ?? globalThis.location;
    this.#timers = options.timers ?? defaultTimers;
    this.#diagnosticReporter =
      options.diagnosticReporter ?? reportBrowserSourceClientDiagnostic;
    this.#nowIso = options.nowIso ?? (() => new Date().toISOString());
    this.#nowMs = options.nowMs ?? (() => Date.now());
    this.#reconnectDelayMs =
      options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    this.#heartbeatIntervalMs =
      options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.#diagnosticIntervalMs =
      options.diagnosticIntervalMs ?? DEFAULT_DIAGNOSTIC_INTERVAL_MS;
    this.#snapshot = {
      connectionStatus: "idle",
      webgl2Available: options.webgl2Available,
      runtimeExportLoaded: false,
      runtimeExportApplyCount: 0,
      renderStatus: options.renderer === null ? "error" : "idle",
      message: options.initialMessage ?? null,
      fps: null,
      frameAgeMs: null
    };
  }

  getSnapshot(): BrowserSourceStageClientSnapshot {
    return this.#snapshot;
  }

  onSnapshotChanged(listener: BrowserSourceStageClientListener): () => void {
    this.#listeners.add(listener);
    listener(this.#snapshot);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  start(): void {
    if (this.#started) {
      return;
    }

    this.#started = true;
    this.#reportDiagnostic("client-start-called");
    this.#connectWebSocket();
    this.#startHeartbeat();
    void this.#loadCurrentRuntimeExport();
  }

  stop(): void {
    this.#started = false;
    this.#clearReconnectTimer();
    this.#clearHeartbeatTimer();
    this.#clearDiagnosticsTimer();

    const socket = this.#socket;
    this.#socket = null;
    socket?.close();
    this.#renderer?.dispose();
  }

  handleServerMessageData(data: unknown): void {
    const message = readBrowserSourceServerMessage(data);
    if (message === null) {
      this.#updateSnapshot({
        message: "Browser Source server message was ignored."
      });
      this.#sendDiagnostics();
      return;
    }

    if (
      message.type === "browser-source-server-hello" ||
      message.type === "browser-source-server-heartbeat"
    ) {
      return;
    }

    if (message.type === "browser-source-error") {
      this.#updateSnapshot({
        connectionStatus: "error",
        message: message.message
      });
      this.#sendDiagnostics();
      return;
    }

    if (message.type === "runtime-export-resync") {
      this.#applyStageDisplayState(message.stageDisplayState);
      this.#applyActiveVariantSelection(message.activeVariantSelection);
      this.#applyRuntimeExportPayload(message.runtimeExport);
      if (message.latestFrame !== null) {
        this.#applyLiveParameterFrame(message.latestFrame);
      }
      return;
    }

    if (message.type === "runtime-export-changed") {
      this.#applyActiveVariantSelection(message.activeVariantSelection);
      this.#applyRuntimeExportPayload(message.runtimeExport);
      return;
    }

    if (message.type === "active-variant-selection-changed") {
      this.#applyActiveVariantSelection(message.activeVariantSelection);
      return;
    }

    if (message.type === "live-parameter-frame") {
      this.#applyLiveParameterFrame(message.frame);
      return;
    }

    if (message.type === "stage-display-state-changed") {
      this.#applyStageDisplayState(message.stageDisplayState);
      return;
    }

    if (message.type === "live-parameter-cleared") {
      this.#metrics.clear();
      this.#renderer?.clearLiveParameterFrame();
      this.#updateSnapshot(this.#withMetrics({ message: null }));
      this.#sendDiagnostics();
    }
  }

  requestResync(): void {
    this.#sendClientMessage({
      type: "browser-source-resync-request",
      requestedAtIso: this.#nowIso()
    });
  }

  #connectWebSocket(): void {
    if (!this.#started) {
      return;
    }

    this.#clearReconnectTimer();
    this.#updateSnapshot({ connectionStatus: "connecting" });

    this.#reportDiagnostic("ws-open-attempt");
    const socket = this.#webSocketFactory(
      createBrowserSourceWebSocketUrl(
        this.#config.webSocketPath,
        this.#location
      )
    );
    this.#socket = socket;

    const handleOpen = (): void => {
      if (this.#socket !== socket) {
        return;
      }

      this.#updateSnapshot({ connectionStatus: "connected" });
      this.#sendClientMessage({
        type: "browser-source-client-heartbeat",
        sentAtIso: this.#nowIso()
      });
      this.requestResync();
      this.#sendDiagnostics();
    };
    const handleMessage = (event: MessageEvent): void => {
      if (this.#socket === socket) {
        this.handleServerMessageData(event.data);
      }
    };
    const handleClose = (): void => {
      if (this.#socket !== socket) {
        return;
      }

      this.#socket = null;
      this.#updateSnapshot({ connectionStatus: "disconnected" });
      this.#sendDiagnostics();
      this.#scheduleReconnect();
    };
    const handleError = (): void => {
      if (this.#socket !== socket) {
        return;
      }

      this.#updateSnapshot({
        connectionStatus: "error",
        message: "Browser Source WebSocket connection failed."
      });
      this.#sendDiagnostics();
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("error", handleError);
  }

  async #loadCurrentRuntimeExport(): Promise<void> {
    this.#updateSnapshot({
      renderStatus: this.#renderer === null ? "error" : "loading"
    });
    this.#sendDiagnostics();

    try {
      const response = await this.#fetcher(
        createBrowserSourceHttpUrl(
          this.#config.runtimeExportPayloadPath,
          this.#location
        )
      );
      if (!response.ok) {
        throw new Error("Browser Source runtime payload request failed.");
      }

      const runtimeExportResponse = readBrowserSourceRuntimeExportResponse(
        await response.json()
      );
      if (runtimeExportResponse === null) {
        throw new Error("Browser Source runtime payload response was invalid.");
      }

      this.#applyStageDisplayState(runtimeExportResponse.stageDisplayState);
      this.#applyActiveVariantSelection(
        runtimeExportResponse.activeVariantSelection
      );
      this.#applyRuntimeExportPayload(runtimeExportResponse.runtimeExport);
    } catch (error) {
      this.#updateSnapshot({
        runtimeExportLoaded: false,
        renderStatus: "error",
        message: toClientMessage(error)
      });
      this.#sendDiagnostics();
    }
  }

  #applyStageDisplayState(
    stageDisplayState: RuntimePlayerBrowserSourceStageDisplayState
  ): void {
    const transform = stageDisplayState.stageView.transform;
    if (transform === null) {
      return;
    }

    this.#renderer?.setViewTransform(transform);
  }

  #applyRuntimeExportPayload(
    payload: RuntimePlayerBrowserSourceRuntimeExportPayload | null
  ): void {
    if (payload === null) {
      this.#metrics.clear();
      this.#runtimeExportPayloadKey = null;
      this.#activeVariantSelection = null;
      this.#renderer?.clear();
      this.#updateSnapshot({
        runtimeExportLoaded: false,
        renderStatus: this.#renderer === null ? "error" : "idle",
        message: this.#renderer === null
          ? this.#snapshot.message
          : null,
        fps: null,
        frameAgeMs: null
      });
      this.#sendDiagnostics();
      return;
    }

    const payloadKey = createRuntimeExportPayloadKey(payload);
    if (
      this.#runtimeExportPayloadKey === payloadKey &&
      this.#snapshot.runtimeExportLoaded
    ) {
      return;
    }

    if (this.#renderer === null) {
      this.#updateSnapshot({
        runtimeExportLoaded: false,
        renderStatus: "error",
        message: this.#snapshot.message ??
          "Browser Source renderer is unavailable."
      });
      this.#sendDiagnostics();
      return;
    }

    try {
      const loadedPayload = toRuntimeExportLoadedPayload(payload);
      this.#renderRuntimeExport(loadedPayload, payloadKey);
    } catch (error) {
      this.#renderer.clear();
      this.#updateSnapshot({
        runtimeExportLoaded: false,
        renderStatus: "error",
        message: toClientMessage(error)
      });
      this.#sendDiagnostics();
    }
  }

  #renderRuntimeExport(
    payload: RuntimeExportLoadedPayload,
    payloadKey: string
  ): void {
    this.#renderer?.setActiveVariantSelection(this.#activeVariantSelection);
    const result = this.#renderer?.setPayload(payload);
    this.#runtimeExportPayloadKey = payloadKey;
    this.#runtimeExportApplyCount += 1;
    this.#updateSnapshot({
      runtimeExportLoaded: true,
      runtimeExportApplyCount: this.#runtimeExportApplyCount,
      renderStatus: "rendering",
      message:
        result !== undefined && result.runtimeDiagnosticDetails.length > 0
          ? result.runtimeDiagnosticDetails.join("; ").slice(0, 240)
          : null
    });
    this.#sendDiagnostics();
  }

  #applyActiveVariantSelection(
    activeVariantSelection: RuntimePlayerActiveVariantSelectionState
  ): void {
    this.#activeVariantSelection = activeVariantSelection;
    this.#renderer?.setActiveVariantSelection(activeVariantSelection);
  }

  #applyLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void {
    this.#metrics.recordLiveParameterFrame(frame);
    this.#renderer?.setLiveParameterFrame(frame);
    this.#updateSnapshot(this.#withMetrics({
      renderStatus: this.#renderer === null
        ? "error"
        : this.#snapshot.renderStatus,
      message: this.#renderer === null ? this.#snapshot.message : null
    }));
    this.#sendDiagnosticsSampled();
  }

  #startHeartbeat(): void {
    if (this.#heartbeatIntervalMs <= 0 || this.#heartbeatTimer !== null) {
      return;
    }

    this.#heartbeatTimer = this.#timers.setInterval(() => {
      this.#sendClientMessage({
        type: "browser-source-client-heartbeat",
        sentAtIso: this.#nowIso()
      });
      this.#sendDiagnostics();
    }, this.#heartbeatIntervalMs);
  }

  #scheduleReconnect(): void {
    if (!this.#started || this.#reconnectTimer !== null) {
      return;
    }

    this.#reconnectTimer = this.#timers.setTimeout(() => {
      this.#reconnectTimer = null;
      this.#connectWebSocket();
    }, this.#reconnectDelayMs);
  }

  #clearReconnectTimer(): void {
    if (this.#reconnectTimer === null) {
      return;
    }

    this.#timers.clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
  }

  #clearHeartbeatTimer(): void {
    if (this.#heartbeatTimer === null) {
      return;
    }

    this.#timers.clearInterval(this.#heartbeatTimer);
    this.#heartbeatTimer = null;
  }

  #sendClientMessage(message: RuntimePlayerBrowserSourceClientMessage): void {
    if (this.#socket === null || this.#snapshot.connectionStatus !== "connected") {
      return;
    }

    this.#socket.send(JSON.stringify(message));
  }

  #sendDiagnostics(): void {
    this.#clearDiagnosticsTimer();
    this.#sendDiagnosticsNow();
  }

  #sendDiagnosticsSampled(): void {
    if (this.#diagnosticIntervalMs <= 0) {
      this.#sendDiagnosticsNow();
      return;
    }

    const nowMs = this.#nowMs();
    if (
      this.#lastDiagnosticsSentAtMs === null ||
      nowMs - this.#lastDiagnosticsSentAtMs >= this.#diagnosticIntervalMs
    ) {
      this.#sendDiagnosticsNow();
      return;
    }

    if (this.#diagnosticsTimer !== null) {
      return;
    }

    this.#diagnosticsTimer = this.#timers.setTimeout(() => {
      this.#diagnosticsTimer = null;
      this.#sendDiagnosticsNow();
    }, Math.max(
      0,
      this.#diagnosticIntervalMs - (nowMs - this.#lastDiagnosticsSentAtMs)
    ));
  }

  #sendDiagnosticsNow(): void {
    this.#lastDiagnosticsSentAtMs = this.#nowMs();
    const metrics = this.#metrics.snapshot(this.#nowMs());
    this.#sendClientMessage({
      type: "browser-source-renderer-diagnostics",
      webgl2Available: this.#snapshot.webgl2Available,
      runtimeExportLoaded: this.#snapshot.runtimeExportLoaded,
      renderStatus: this.#snapshot.renderStatus,
      message: this.#snapshot.message,
      fps: metrics.fps,
      frameAgeMs: metrics.frameAgeMs
    });
  }

  #clearDiagnosticsTimer(): void {
    if (this.#diagnosticsTimer === null) {
      return;
    }

    this.#timers.clearTimeout(this.#diagnosticsTimer);
    this.#diagnosticsTimer = null;
  }

  #reportDiagnostic(
    event: Parameters<BrowserSourceClientDiagnosticReporter>[0]["event"]
  ): void {
    this.#diagnosticReporter({
      event,
      message: null,
      source: null,
      line: null,
      column: null
    });
  }

  #withMetrics(
    patch: Partial<BrowserSourceStageClientSnapshot>
  ): Partial<BrowserSourceStageClientSnapshot> {
    return {
      ...patch,
      ...this.#metrics.snapshot(this.#nowMs())
    };
  }

  #updateSnapshot(patch: Partial<BrowserSourceStageClientSnapshot>): void {
    this.#snapshot = {
      ...this.#snapshot,
      ...patch
    };

    for (const listener of this.#listeners) {
      listener(this.#snapshot);
    }
  }
}

const defaultTimers: BrowserSourceStageClientTimers = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle);
  },
  setInterval: (callback, delayMs) =>
    globalThis.setInterval(callback, delayMs),
  clearInterval: (handle) => {
    globalThis.clearInterval(handle);
  }
};

function defaultFetch(url: string): ReturnType<BrowserSourceStageClientFetch> {
  if (typeof globalThis.fetch !== "function") {
    return Promise.reject(
      new Error("Browser Source fetch is unavailable in this browser.")
    );
  }

  return globalThis.fetch(url);
}

function defaultWebSocketFactory(url: string): BrowserSourceWebSocketLike {
  if (typeof globalThis.WebSocket !== "function") {
    throw new Error("Browser Source WebSocket is unavailable in this browser.");
  }

  return new globalThis.WebSocket(url);
}

function toClientMessage(error: unknown): string {
  return error instanceof Error
    ? error.message.slice(0, 240)
    : "Browser Source client operation failed.";
}

function createRuntimeExportPayloadKey(
  payload: RuntimePlayerBrowserSourceRuntimeExportPayload
): string {
  const textureMetadata = payload.texturePage.metadata;
  return [
    payload.schemaVersion,
    payload.summary.packageId,
    payload.summary.packageRevision,
    payload.loadedAtIso,
    textureMetadata.pageId,
    textureMetadata.path,
    textureMetadata.width,
    textureMetadata.height,
    textureMetadata.pixelFormat,
    textureMetadata.byteLength,
    payload.texturePage.byteLength
  ].join("|");
}
