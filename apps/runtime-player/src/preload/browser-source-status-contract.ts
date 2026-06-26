import type {
  RuntimePlayerRuntimeCoreProfilingMode,
  RuntimePlayerStageRenderMetricsSnapshot
} from "./performance-diagnostics-contract";

export type RuntimePlayerBrowserSourceBindAddress = "127.0.0.1";

export type RuntimePlayerBrowserSourceServerState =
  | "starting"
  | "running"
  | "stopped"
  | "error";

export type RuntimePlayerBrowserSourceRuntimeExportStatus = {
  readonly state: "empty" | "loading" | "loaded" | "error";
  readonly loaded: boolean;
  readonly statusLabel: string;
  readonly loadedAtIso: string | null;
  readonly summary: {
    readonly modelDisplayName: string;
    readonly packageId: string;
    readonly packageRevision: number;
    readonly drawableCount: number;
    readonly meshCount: number;
    readonly parameterCount: number;
    readonly maskCount: number;
  } | null;
};

export type RuntimePlayerBrowserSourceFrameStatus = {
  readonly sequence: number;
  readonly producedAtIso: string;
} | null;

export type RuntimePlayerBrowserSourceStageWindowBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type RuntimePlayerBrowserSourceStageViewTransform = {
  readonly zoomScale: number;
  readonly pan: {
    readonly x: number;
    readonly y: number;
  };
  readonly coordinateSpace: "stage-viewport-px-v1";
};

export type RuntimePlayerBrowserSourceStageDisplayState = {
  readonly stageWindow: {
    readonly bounds: RuntimePlayerBrowserSourceStageWindowBounds | null;
  };
  readonly stageView: {
    readonly transform: RuntimePlayerBrowserSourceStageViewTransform | null;
  };
  readonly updatedAtIso: string | null;
};

export type RuntimePlayerBrowserSourceRendererDiagnostics = {
  readonly clientId: number;
  readonly receivedAtIso: string;
  readonly webgl2Available: "available" | "unavailable" | "unknown";
  readonly runtimeExportLoaded: boolean;
  readonly renderStatus: "idle" | "loading" | "rendering" | "error";
  readonly message: string | null;
  readonly fps: number | null;
  readonly sourceFps?: number | null;
  readonly frameAgeMs: number | null;
  readonly renderMetrics?: RuntimePlayerStageRenderMetricsSnapshot | null;
};

export type RuntimePlayerBrowserSourceClientDiagnosticEvent =
  | "html-inline-boot"
  | "module-script-tag-injected"
  | "module-entry-started"
  | "client-start-called"
  | "ws-open-attempt"
  | "window-error"
  | "unhandled-rejection";

export type RuntimePlayerBrowserSourceClientDiagnostic = {
  readonly reportedAtIso: string;
  readonly event: RuntimePlayerBrowserSourceClientDiagnosticEvent;
  readonly message: string | null;
  readonly source: string | null;
  readonly line: number | null;
  readonly column: number | null;
};

export type RuntimePlayerBrowserSourceStageRequestDiagnostic = {
  readonly requestedAtIso: string;
  readonly statusCode: number;
  readonly statusLabel: "served" | "unauthorized" | "method-not-allowed";
};

export type RuntimePlayerBrowserSourceAssetRequestDiagnostic = {
  readonly requestedAtIso: string;
  readonly routeKind: "built" | "dev";
  readonly statusCode: number;
  readonly statusLabel:
    | "served"
    | "not-found"
    | "proxy-unavailable"
    | "proxy-error"
    | "upstream-status";
};

export type RuntimePlayerBrowserSourceWsUpgradeRejectReason =
  | "invalid-url"
  | "wrong-path"
  | "missing-token"
  | "invalid-token"
  | "missing-websocket-key";

export type RuntimePlayerBrowserSourceWsUpgradeRejectedDiagnostic = {
  readonly rejectedAtIso: string;
  readonly statusCode: number;
  readonly statusLabel: "Unauthorized" | "Bad Request";
  readonly reason: RuntimePlayerBrowserSourceWsUpgradeRejectReason;
};

export type RuntimePlayerBrowserSourceRequestDiagnostics = {
  readonly lastStageRequest:
    | RuntimePlayerBrowserSourceStageRequestDiagnostic
    | null;
  readonly lastAssetRequest:
    | RuntimePlayerBrowserSourceAssetRequestDiagnostic
    | null;
  readonly lastWsUpgradeRejected:
    | RuntimePlayerBrowserSourceWsUpgradeRejectedDiagnostic
    | null;
  readonly lastWsConnectedAtIso: string | null;
  readonly lastWsDisconnectedAtIso: string | null;
};

export type RuntimePlayerBrowserSourceStatus = {
  readonly schemaVersion: "runtime-player-browser-source-status-v1";
  readonly state: RuntimePlayerBrowserSourceServerState;
  readonly statusLabel: string;
  readonly bindAddress: RuntimePlayerBrowserSourceBindAddress;
  readonly port: number | null;
  readonly browserSourceUrl: string | null;
  readonly connectedClientCount: number;
  readonly runtimeExport: RuntimePlayerBrowserSourceRuntimeExportStatus;
  readonly latestFrame: RuntimePlayerBrowserSourceFrameStatus;
  readonly stageDisplayState: RuntimePlayerBrowserSourceStageDisplayState;
  readonly lastClientConnectedAtIso: string | null;
  readonly lastClientDisconnectedAtIso: string | null;
  readonly lastClientHeartbeatAtIso: string | null;
  readonly lastServerHeartbeatAtIso: string | null;
  readonly latestRendererDiagnostics:
    | RuntimePlayerBrowserSourceRendererDiagnostics
    | null;
  readonly latestClientDiagnostic:
    | RuntimePlayerBrowserSourceClientDiagnostic
    | null;
  readonly requestDiagnostics: RuntimePlayerBrowserSourceRequestDiagnostics;
  readonly errorMessage: string | null;
  readonly updatedAtIso: string;
};

export type RuntimePlayerBrowserSourceApi = {
  readonly getStatus: () => Promise<RuntimePlayerBrowserSourceStatus>;
  readonly setRuntimeCoreProfiling: (
    mode: RuntimePlayerRuntimeCoreProfilingMode
  ) => Promise<RuntimePlayerRuntimeCoreProfilingMode>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerBrowserSourceStatus) => void
  ) => () => void;
};
