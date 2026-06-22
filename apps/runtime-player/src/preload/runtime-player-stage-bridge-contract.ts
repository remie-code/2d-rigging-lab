import type {
  RuntimeExportLoadedPayload,
  RuntimeExportStatus
} from "./runtime-export-bridge-contract";
import type { RuntimePlayerLiveParameterApi } from "./live-parameter-bridge-contract";
import type {
  RuntimePlayerStageViewStatusReport
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
  readonly reportStatus: (
    status: RuntimePlayerStageViewStatusReport
  ) => Promise<void>;
  readonly onResetViewRequested: (callback: () => void) => () => void;
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
