import type {
  RuntimeExportLoadedPayload,
  RuntimeExportStatus
} from "./runtime-export-bridge-contract";
import type {
  RuntimePlayerStageDynamicsTuningApi
} from "./dynamics-tuning-bridge-contract";
import type { RuntimePlayerLiveParameterApi } from "./live-parameter-bridge-contract";
import type {
  RuntimePlayerVariantControllerStatus
} from "./runtime-variant-bridge-contract";
import type {
  RuntimePlayerStageArrangeState,
  RuntimePlayerStageViewStatusReport,
  RuntimePlayerStageViewTransform
} from "./runtime-player-bridge-contract";
import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "./performance-diagnostics-contract";

export type RuntimePlayerStageRuntimeExportApi = {
  readonly getLoadedPayload: () => Promise<RuntimeExportLoadedPayload | null>;
  readonly onStatusChanged: (
    callback: (status: RuntimeExportStatus) => void
  ) => () => void;
  readonly onLoadedPayload: (
    callback: (payload: RuntimeExportLoadedPayload) => void
  ) => () => void;
};

export type RuntimePlayerStageViewReporterApi = {
  readonly getViewTransform: () => Promise<RuntimePlayerStageViewTransform>;
  readonly getArrangeState: () => Promise<RuntimePlayerStageArrangeState>;
  readonly reportStatus: (
    status: RuntimePlayerStageViewStatusReport
  ) => Promise<void>;
  readonly reportViewTransform: (
    transform: RuntimePlayerStageViewTransform
  ) => Promise<void>;
  readonly reportRenderMetrics: (
    snapshot: RuntimePlayerStageRenderMetricsSnapshot
  ) => Promise<void>;
  readonly onApplyViewTransformRequested: (
    callback: (transform: RuntimePlayerStageViewTransform) => void
  ) => () => void;
  readonly onApplyDisplayViewTransformRequested: (
    callback: (transform: RuntimePlayerStageViewTransform | null) => void
  ) => () => void;
  readonly onArrangeStateChanged: (
    callback: (state: RuntimePlayerStageArrangeState) => void
  ) => () => void;
};

export type RuntimePlayerStageVariantApi = {
  readonly getStatus: () => Promise<RuntimePlayerVariantControllerStatus>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerVariantControllerStatus) => void
  ) => () => void;
};

export type RuntimePlayerStageApi = {
  readonly runtimeExport: RuntimePlayerStageRuntimeExportApi;
  readonly dynamicsTuning: RuntimePlayerStageDynamicsTuningApi;
  readonly variants: RuntimePlayerStageVariantApi;
  readonly liveParameters: RuntimePlayerLiveParameterApi;
  readonly stageView: RuntimePlayerStageViewReporterApi;
};

declare global {
  interface Window {
    readonly runtimePlayerStage: RuntimePlayerStageApi;
  }
}
