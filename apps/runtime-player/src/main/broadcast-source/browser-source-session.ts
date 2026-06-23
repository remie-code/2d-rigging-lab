import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  runtimePlayerBrowserSourceProtocolVersion,
  type RuntimePlayerBrowserSourceClientMessage,
  type RuntimePlayerBrowserSourceRuntimeExportPayload,
  type RuntimePlayerBrowserSourceServerMessage
} from "../../preload/browser-source-transport-contract";
import type {
  RuntimePlayerBrowserSourceAssetRequestDiagnostic,
  RuntimePlayerBrowserSourceClientDiagnostic,
  RuntimePlayerBrowserSourceStageDisplayState,
  RuntimePlayerBrowserSourceStageRequestDiagnostic,
  RuntimePlayerBrowserSourceStatus,
  RuntimePlayerBrowserSourceWsUpgradeRejectedDiagnostic
} from "../../preload/browser-source-status-contract";
import {
  createBrowserSourceEmptyRuntimeExportStatus,
  createBrowserSourceLoadedRuntimeExportStatus,
  toBrowserSourceRuntimeExportPayload
} from "./browser-source-runtime-export-payload";
import { createBrowserSourceStageUrl } from "./browser-source-url";

export type BrowserSourceSessionClient = {
  readonly send: (message: RuntimePlayerBrowserSourceServerMessage) => void;
  readonly close: () => void;
};

export type BrowserSourceSessionStatusListener = (
  status: RuntimePlayerBrowserSourceStatus
) => void;

export type BrowserSourceSessionTimers = {
  readonly setTimeout: (
    callback: () => void,
    delayMs: number
  ) => BrowserSourceSessionTimerHandle;
  readonly clearTimeout: (handle: BrowserSourceSessionTimerHandle) => void;
};

export type BrowserSourceSessionTimerHandle =
  | number
  | ReturnType<typeof globalThis.setTimeout>;

type BrowserSourceStatusNotificationMode = "immediate" | "sampled";

const DEFAULT_STATUS_NOTIFICATION_INTERVAL_MS = 500;

export class RuntimePlayerBrowserSourceSession {
  readonly #token: string;
  readonly #nowIso: () => string;
  readonly #nowMs: () => number;
  readonly #timers: BrowserSourceSessionTimers;
  readonly #statusNotificationIntervalMs: number;
  readonly #clients = new Map<number, BrowserSourceSessionClient>();
  readonly #listeners = new Set<BrowserSourceSessionStatusListener>();
  #nextClientId = 1;
  #status: RuntimePlayerBrowserSourceStatus;
  #runtimeExport:
    | RuntimePlayerBrowserSourceRuntimeExportPayload
    | null = null;
  #latestFrame: RuntimePlayerLiveParameterFrame | null = null;
  #lastStatusNotifiedAtMs: number | null = null;
  #sampledStatusTimer: BrowserSourceSessionTimerHandle | null = null;
  #stageDisplayState: RuntimePlayerBrowserSourceStageDisplayState =
    createEmptyStageDisplayState();

  constructor(input: {
    readonly token: string;
    readonly nowIso?: () => string;
    readonly nowMs?: () => number;
    readonly timers?: BrowserSourceSessionTimers;
    readonly statusNotificationIntervalMs?: number;
  }) {
    this.#token = input.token;
    this.#nowIso = input.nowIso ?? (() => new Date().toISOString());
    this.#nowMs = input.nowMs ?? (() => Date.now());
    this.#timers = input.timers ?? defaultTimers;
    this.#statusNotificationIntervalMs =
      input.statusNotificationIntervalMs ??
      DEFAULT_STATUS_NOTIFICATION_INTERVAL_MS;
    this.#status = {
      schemaVersion: "runtime-player-browser-source-status-v1",
      state: "stopped",
      statusLabel: "Browser Source server stopped",
      bindAddress: "127.0.0.1",
      port: null,
      browserSourceUrl: null,
      connectedClientCount: 0,
      runtimeExport: createBrowserSourceEmptyRuntimeExportStatus(),
      latestFrame: null,
      stageDisplayState: this.#stageDisplayState,
      lastClientConnectedAtIso: null,
      lastClientDisconnectedAtIso: null,
      lastClientHeartbeatAtIso: null,
      lastServerHeartbeatAtIso: null,
      latestRendererDiagnostics: null,
      latestClientDiagnostic: null,
      requestDiagnostics: createEmptyRequestDiagnostics(),
      errorMessage: null,
      updatedAtIso: this.#nowIso()
    };
  }

  getStatus(): RuntimePlayerBrowserSourceStatus {
    return this.#status;
  }

  getRuntimeExportPayload():
    | RuntimePlayerBrowserSourceRuntimeExportPayload
    | null {
    return this.#runtimeExport;
  }

  getLatestFrame(): RuntimePlayerLiveParameterFrame | null {
    return this.#latestFrame;
  }

  getStageDisplayState(): RuntimePlayerBrowserSourceStageDisplayState {
    return this.#stageDisplayState;
  }

  onStatusChanged(
    listener: BrowserSourceSessionStatusListener
  ): () => void {
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
    };
  }

  markStarting(): void {
    this.#updateStatus({
      state: "starting",
      statusLabel: "Starting Browser Source server",
      port: null,
      browserSourceUrl: null,
      requestDiagnostics: createEmptyRequestDiagnostics(),
      latestClientDiagnostic: null,
      errorMessage: null
    });
  }

  markRunning(input: {
    readonly port: number;
    readonly preferredPort: number;
  }): void {
    const isFallbackPort =
      input.preferredPort > 0 && input.port !== input.preferredPort;

    this.#updateStatus({
      state: "running",
      statusLabel: isFallbackPort
        ? "Browser Source server running on fallback port"
        : "Browser Source server running",
      port: input.port,
      browserSourceUrl: createBrowserSourceStageUrl({
        port: input.port,
        token: this.#token
      }),
      errorMessage: null
    });
  }

  markStopped(): void {
    this.closeClients();
    this.#updateStatus({
      state: "stopped",
      statusLabel: "Browser Source server stopped",
      port: null,
      browserSourceUrl: null,
      connectedClientCount: 0
    });
  }

  markError(error: unknown): void {
    this.#updateStatus({
      state: "error",
      statusLabel: "Browser Source server error",
      errorMessage: toErrorMessage(error)
    });
  }

  publishRuntimeExportLoaded(payload: RuntimeExportLoadedPayload): void {
    this.#runtimeExport = toBrowserSourceRuntimeExportPayload(payload);
    this.#updateStatus({
      runtimeExport: createBrowserSourceLoadedRuntimeExportStatus(payload)
    });
    this.#broadcast({
      type: "runtime-export-changed",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      runtimeExport: this.#runtimeExport,
      runtimeExportStatus: this.#status.runtimeExport,
      sentAtIso: this.#nowIso()
    });
  }

  clearRuntimeExport(statusLabel = "No Runtime Export loaded"): void {
    this.#runtimeExport = null;
    this.clearLatestFrame();
    this.#updateStatus({
      runtimeExport: createBrowserSourceEmptyRuntimeExportStatus(statusLabel)
    });
    this.#broadcast({
      type: "runtime-export-changed",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      runtimeExport: null,
      runtimeExportStatus: this.#status.runtimeExport,
      sentAtIso: this.#nowIso()
    });
  }

  publishLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void {
    this.#latestFrame = frame;
    this.#updateStatus({
      latestFrame: {
        sequence: frame.sequence,
        producedAtIso: frame.producedAtIso
      }
    }, {
      notify: "sampled"
    });
    this.#broadcast({
      type: "live-parameter-frame",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      frame,
      sentAtIso: this.#nowIso()
    });
  }

  clearLatestFrame(): void {
    if (this.#latestFrame === null && this.#status.latestFrame === null) {
      return;
    }

    this.#latestFrame = null;
    this.#updateStatus({ latestFrame: null });
    this.#broadcast({
      type: "live-parameter-cleared",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      sentAtIso: this.#nowIso()
    });
  }

  publishStageDisplayState(input: {
    readonly stageWindow: RuntimePlayerBrowserSourceStageDisplayState["stageWindow"];
    readonly stageView: RuntimePlayerBrowserSourceStageDisplayState["stageView"];
  }): void {
    this.#stageDisplayState = {
      stageWindow: input.stageWindow,
      stageView: input.stageView,
      updatedAtIso: this.#nowIso()
    };
    this.#updateStatus({
      stageDisplayState: this.#stageDisplayState
    });
    this.#broadcast({
      type: "stage-display-state-changed",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      stageDisplayState: this.#stageDisplayState,
      sentAtIso: this.#nowIso()
    });
  }

  markStageRequest(
    diagnostic: Omit<
      RuntimePlayerBrowserSourceStageRequestDiagnostic,
      "requestedAtIso"
    >
  ): void {
    this.#updateStatus({
      requestDiagnostics: {
        ...this.#status.requestDiagnostics,
        lastStageRequest: {
          requestedAtIso: this.#nowIso(),
          ...diagnostic
        }
      }
    });
  }

  markAssetRequest(
    diagnostic: Omit<
      RuntimePlayerBrowserSourceAssetRequestDiagnostic,
      "requestedAtIso"
    >
  ): void {
    this.#updateStatus({
      requestDiagnostics: {
        ...this.#status.requestDiagnostics,
        lastAssetRequest: {
          requestedAtIso: this.#nowIso(),
          ...diagnostic
        }
      }
    });
  }

  markWsUpgradeRejected(
    diagnostic: Omit<
      RuntimePlayerBrowserSourceWsUpgradeRejectedDiagnostic,
      "rejectedAtIso"
    >
  ): void {
    this.#updateStatus({
      requestDiagnostics: {
        ...this.#status.requestDiagnostics,
        lastWsUpgradeRejected: {
          rejectedAtIso: this.#nowIso(),
          ...diagnostic
        }
      }
    });
  }

  markClientDiagnostic(
    diagnostic: Omit<
      RuntimePlayerBrowserSourceClientDiagnostic,
      "reportedAtIso"
    >
  ): void {
    this.#updateStatus({
      latestClientDiagnostic: {
        reportedAtIso: this.#nowIso(),
        ...diagnostic
      }
    });
  }

  addClient(client: BrowserSourceSessionClient): number {
    const clientId = this.#nextClientId;
    const connectedAtIso = this.#nowIso();
    this.#nextClientId += 1;
    this.#clients.set(clientId, client);
    this.#updateStatus({
      connectedClientCount: this.#clients.size,
      lastClientConnectedAtIso: connectedAtIso,
      requestDiagnostics: {
        ...this.#status.requestDiagnostics,
        lastWsConnectedAtIso: connectedAtIso
      }
    });
    client.send({
      type: "browser-source-server-hello",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      sentAtIso: this.#nowIso()
    });
    this.sendResync(client);

    return clientId;
  }

  removeClient(clientId: number): void {
    if (!this.#clients.delete(clientId)) {
      return;
    }

    const disconnectedAtIso = this.#nowIso();
    this.#updateStatus({
      connectedClientCount: this.#clients.size,
      lastClientDisconnectedAtIso: disconnectedAtIso,
      requestDiagnostics: {
        ...this.#status.requestDiagnostics,
        lastWsDisconnectedAtIso: disconnectedAtIso
      }
    });
  }

  handleClientMessage(
    clientId: number,
    message: RuntimePlayerBrowserSourceClientMessage | null
  ): void {
    const client = this.#clients.get(clientId);

    if (client === undefined) {
      return;
    }

    if (message === null) {
      client.send({
        type: "browser-source-error",
        protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
        errorCode: "invalid-message",
        message: "Browser Source client message was not recognized.",
        sentAtIso: this.#nowIso()
      });
      return;
    }

    if (message.type === "browser-source-resync-request") {
      this.sendResync(client);
      return;
    }

    if (message.type === "browser-source-client-heartbeat") {
      this.#updateStatus({
        lastClientHeartbeatAtIso: this.#nowIso()
      });
      return;
    }

    if (message.type === "browser-source-renderer-diagnostics") {
      const latestRendererDiagnostics = {
        clientId,
        receivedAtIso: this.#nowIso(),
        webgl2Available: message.webgl2Available,
        runtimeExportLoaded: message.runtimeExportLoaded,
        renderStatus: message.renderStatus,
        message: message.message,
        fps: message.fps,
        frameAgeMs: message.frameAgeMs
      };
      const previousRendererDiagnostics =
        this.#status.latestRendererDiagnostics;

      this.#updateStatus({
        lastClientHeartbeatAtIso: this.#nowIso(),
        latestRendererDiagnostics
      }, {
        notify: isImportantRendererDiagnosticsChange(
          previousRendererDiagnostics,
          latestRendererDiagnostics
        )
          ? "immediate"
          : "sampled"
      });
    }
  }

  sendResync(client: BrowserSourceSessionClient): void {
    client.send({
      type: "runtime-export-resync",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      runtimeExport: this.#runtimeExport,
      runtimeExportStatus: this.#status.runtimeExport,
      latestFrame: this.#latestFrame,
      stageDisplayState: this.#stageDisplayState,
      sentAtIso: this.#nowIso()
    });
  }

  broadcastServerHeartbeat(): void {
    const sentAtIso = this.#nowIso();
    this.#updateStatus({
      lastServerHeartbeatAtIso: sentAtIso
    });
    this.#broadcast({
      type: "browser-source-server-heartbeat",
      protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
      sentAtIso
    });
  }

  closeClients(): void {
    const clients = [...this.#clients.values()];
    this.#clients.clear();
    for (const client of clients) {
      client.close();
    }
    this.#clearSampledStatusTimer();
  }

  #broadcast(message: RuntimePlayerBrowserSourceServerMessage): void {
    for (const client of this.#clients.values()) {
      client.send(message);
    }
  }

  #updateStatus(
    patch: Partial<RuntimePlayerBrowserSourceStatus>,
    options: {
      readonly notify?: BrowserSourceStatusNotificationMode;
    } = {}
  ): RuntimePlayerBrowserSourceStatus {
    this.#status = {
      ...this.#status,
      ...patch,
      updatedAtIso: this.#nowIso()
    };

    if ((options.notify ?? "immediate") === "sampled") {
      this.#notifyStatusChangedSampled();
    } else {
      this.#notifyStatusChangedImmediately();
    }

    return this.#status;
  }

  #notifyStatusChangedImmediately(): void {
    this.#clearSampledStatusTimer();
    this.#emitStatusChanged();
  }

  #notifyStatusChangedSampled(): void {
    if (this.#listeners.size === 0) {
      return;
    }

    if (this.#statusNotificationIntervalMs <= 0) {
      this.#emitStatusChanged();
      return;
    }

    const nowMs = this.#nowMs();
    if (
      this.#lastStatusNotifiedAtMs === null ||
      nowMs - this.#lastStatusNotifiedAtMs >=
        this.#statusNotificationIntervalMs
    ) {
      this.#emitStatusChanged();
      return;
    }

    if (this.#sampledStatusTimer !== null) {
      return;
    }

    this.#sampledStatusTimer = this.#timers.setTimeout(() => {
      this.#sampledStatusTimer = null;
      this.#emitStatusChanged();
    }, Math.max(
      0,
      this.#statusNotificationIntervalMs - (nowMs - this.#lastStatusNotifiedAtMs)
    ));
  }

  #emitStatusChanged(): void {
    this.#lastStatusNotifiedAtMs = this.#nowMs();
    for (const listener of this.#listeners) {
      listener(this.#status);
    }
  }

  #clearSampledStatusTimer(): void {
    if (this.#sampledStatusTimer === null) {
      return;
    }

    this.#timers.clearTimeout(this.#sampledStatusTimer);
    this.#sampledStatusTimer = null;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createEmptyRequestDiagnostics(): RuntimePlayerBrowserSourceStatus["requestDiagnostics"] {
  return {
    lastStageRequest: null,
    lastAssetRequest: null,
    lastWsUpgradeRejected: null,
    lastWsConnectedAtIso: null,
    lastWsDisconnectedAtIso: null
  };
}

function createEmptyStageDisplayState(): RuntimePlayerBrowserSourceStageDisplayState {
  return {
    stageWindow: {
      bounds: null
    },
    stageView: {
      transform: null
    },
    updatedAtIso: null
  };
}

function isImportantRendererDiagnosticsChange(
  previous: RuntimePlayerBrowserSourceStatus["latestRendererDiagnostics"],
  next: NonNullable<RuntimePlayerBrowserSourceStatus["latestRendererDiagnostics"]>
): boolean {
  return (
    previous === null ||
    previous.webgl2Available !== next.webgl2Available ||
    previous.runtimeExportLoaded !== next.runtimeExportLoaded ||
    previous.renderStatus !== next.renderStatus ||
    previous.message !== next.message ||
    next.renderStatus === "error"
  );
}

const defaultTimers: BrowserSourceSessionTimers = {
  setTimeout: (callback, delayMs) => {
    const handle = globalThis.setTimeout(callback, delayMs);
    if (
      typeof handle === "object" &&
      handle !== null &&
      "unref" in handle &&
      typeof handle.unref === "function"
    ) {
      handle.unref();
    }
    return handle;
  },
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle);
  }
};
