import type { RuntimePlayerLiveParameterFrame } from "./live-parameter-bridge-contract";
import type { RuntimeExportLoadedPayload } from "./runtime-export-bridge-contract";
import type {
  RuntimePlayerBrowserSourceStageDisplayState,
  RuntimePlayerBrowserSourceRuntimeExportStatus
} from "./browser-source-status-contract";
import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "./performance-diagnostics-contract";
import type {
  RuntimePlayerEffectiveDynamicsTuningProfile
} from "./dynamics-tuning-bridge-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "./runtime-variant-bridge-contract";

export const runtimePlayerBrowserSourceProtocolVersion = 1 as const;

export type RuntimePlayerBrowserSourceRuntimeExportPayload = {
  readonly schemaVersion: "runtime-player-browser-source-runtime-export-v1";
  readonly artifacts: RuntimeExportLoadedPayload["artifacts"];
  readonly texturePage: {
    readonly metadata: RuntimeExportLoadedPayload["texturePage"]["metadata"];
    readonly encoding: "base64";
    readonly bytesBase64: string;
    readonly byteLength: number;
  };
  readonly summary: RuntimeExportLoadedPayload["summary"];
  readonly loadedAtIso: string;
};

export type RuntimePlayerBrowserSourceRuntimeExportResponse =
  | {
      readonly status: "loaded";
      readonly runtimeExportStatus:
        RuntimePlayerBrowserSourceRuntimeExportStatus;
      readonly stageDisplayState: RuntimePlayerBrowserSourceStageDisplayState;
      readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState;
      readonly effectiveDynamicsTuning:
        RuntimePlayerEffectiveDynamicsTuningProfile | null;
      readonly runtimeExport: RuntimePlayerBrowserSourceRuntimeExportPayload;
    }
  | {
      readonly status: "not-loaded";
      readonly runtimeExportStatus:
        RuntimePlayerBrowserSourceRuntimeExportStatus;
      readonly stageDisplayState: RuntimePlayerBrowserSourceStageDisplayState;
      readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState;
      readonly effectiveDynamicsTuning:
        RuntimePlayerEffectiveDynamicsTuningProfile | null;
      readonly runtimeExport: null;
    };

export type RuntimePlayerBrowserSourceServerMessage =
  | {
      readonly type: "browser-source-server-hello";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly sentAtIso: string;
    }
  | {
      readonly type: "runtime-export-resync";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly runtimeExport:
        RuntimePlayerBrowserSourceRuntimeExportPayload
        | null;
      readonly runtimeExportStatus:
        RuntimePlayerBrowserSourceRuntimeExportStatus;
      readonly latestFrame: RuntimePlayerLiveParameterFrame | null;
      readonly stageDisplayState: RuntimePlayerBrowserSourceStageDisplayState;
      readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState;
      readonly effectiveDynamicsTuning:
        RuntimePlayerEffectiveDynamicsTuningProfile | null;
      readonly sentAtIso: string;
    }
  | {
      readonly type: "runtime-export-changed";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly runtimeExport:
        RuntimePlayerBrowserSourceRuntimeExportPayload
        | null;
      readonly runtimeExportStatus:
        RuntimePlayerBrowserSourceRuntimeExportStatus;
      readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState;
      readonly effectiveDynamicsTuning:
        RuntimePlayerEffectiveDynamicsTuningProfile | null;
      readonly sentAtIso: string;
    }
  | {
      readonly type: "dynamics-tuning-changed";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly effectiveDynamicsTuning:
        RuntimePlayerEffectiveDynamicsTuningProfile | null;
      readonly sentAtIso: string;
    }
  | {
      readonly type: "active-variant-selection-changed";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState;
      readonly sentAtIso: string;
    }
  | {
      readonly type: "live-parameter-frame";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly frame: RuntimePlayerLiveParameterFrame;
      readonly sentAtIso: string;
    }
  | {
      readonly type: "live-parameter-cleared";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly sentAtIso: string;
    }
  | {
      readonly type: "stage-display-state-changed";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly stageDisplayState: RuntimePlayerBrowserSourceStageDisplayState;
      readonly sentAtIso: string;
    }
  | {
      readonly type: "browser-source-server-heartbeat";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly sentAtIso: string;
    }
  | {
      readonly type: "browser-source-error";
      readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
      readonly errorCode: "invalid-message" | "unsupported-message";
      readonly message: string;
      readonly sentAtIso: string;
    };

export type RuntimePlayerBrowserSourceClientMessage =
  | {
      readonly type: "browser-source-resync-request";
      readonly requestedAtIso: string | null;
    }
  | {
      readonly type: "browser-source-client-heartbeat";
      readonly sentAtIso: string | null;
    }
  | {
      readonly type: "browser-source-renderer-diagnostics";
      readonly webgl2Available: "available" | "unavailable" | "unknown";
      readonly runtimeExportLoaded: boolean;
      readonly renderStatus: "idle" | "loading" | "rendering" | "error";
      readonly message: string | null;
      readonly fps: number | null;
      readonly sourceFps?: number | null;
      readonly frameAgeMs: number | null;
      readonly renderMetrics?: RuntimePlayerStageRenderMetricsSnapshot | null;
    };
