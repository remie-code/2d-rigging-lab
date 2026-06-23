import type {
  RuntimeExportLoadedPayload,
  RuntimeExportStatus
} from "./runtime-export-bridge-contract";
import type { RuntimePlayerLiveParameterApi } from "./live-parameter-bridge-contract";
import type {
  RuntimePlayerStageViewStatusReport,
  RuntimePlayerStageViewTransform
} from "./runtime-player-bridge-contract";

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
  readonly reportStatus: (
    status: RuntimePlayerStageViewStatusReport
  ) => Promise<void>;
  readonly reportViewTransform: (
    transform: RuntimePlayerStageViewTransform
  ) => Promise<void>;
  readonly onApplyViewTransformRequested: (
    callback: (transform: RuntimePlayerStageViewTransform) => void
  ) => () => void;
};

export type RuntimePlayerStageApi = {
  readonly runtimeExport: RuntimePlayerStageRuntimeExportApi;
  readonly liveParameters: RuntimePlayerLiveParameterApi;
  readonly stageView: RuntimePlayerStageViewReporterApi;
};

declare global {
  interface Window {
    readonly runtimePlayerStage: RuntimePlayerStageApi;
  }
}
