import type {
  RuntimeExportApi,
  RuntimeExportStatus
} from "./runtime-export-bridge-contract";
import type { RuntimePlayerInputApi } from "./input-bridge-contract";
import type { RuntimePlayerInputProfileApi } from "./input-profile-bridge-contract";
import type { RuntimePlayerLiveParameterApi } from "./live-parameter-bridge-contract";
import type { RuntimePlayerModelMappingApi } from "./model-mapping-bridge-contract";

export const runtimePlayerPlaceholderActions = [
  "open-settings",
  "connect-input",
  "disconnect-input",
  "look-forward",
  "focus-stage",
  "reset-stage-position",
  "open-debug"
] as const;

export type RuntimePlayerPlaceholderAction =
  (typeof runtimePlayerPlaceholderActions)[number];

export type RuntimePlayerInputSourceSnapshot = {
  readonly sourceLabel: "iFacialMocap";
  readonly transportLabel: "UDP";
  readonly receivePort: 49983;
  readonly connectionState: "not-connected";
};

export type RuntimePlayerStartupStatus = {
  readonly runtimeExport: RuntimeExportStatus;
  readonly input: RuntimePlayerInputSourceSnapshot;
  readonly stage: RuntimePlayerStageStatus;
};

export type RuntimePlayerStageStatus = {
  readonly windowState: "created";
  readonly transparent: true;
  readonly captureTarget: true;
  readonly placeholderLabel: "Transparent Stage placeholder";
};

export type RuntimePlayerPlaceholderResult = {
  readonly action: RuntimePlayerPlaceholderAction;
  readonly handled: boolean;
  readonly message: string;
  readonly atIso: string;
};

export type RuntimePlayerStageViewStatusKind =
  | "empty"
  | "ready"
  | "warning"
  | "error";

export type RuntimePlayerStageViewStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "error";

export type RuntimePlayerStageViewStatusReport = {
  readonly status: RuntimePlayerStageViewStatusKind;
  readonly statusLabel: string;
  readonly message: string;
  readonly details: readonly string[];
};

export type RuntimePlayerStageViewStatus = RuntimePlayerStageViewStatusReport & {
  readonly tone: RuntimePlayerStageViewStatusTone;
  readonly updatedAtIso: string;
};

export type RuntimePlayerStageViewApi = {
  readonly getStatus: () => Promise<RuntimePlayerStageViewStatus>;
  readonly reportStatus: (
    status: RuntimePlayerStageViewStatusReport
  ) => Promise<RuntimePlayerStageViewStatus>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerStageViewStatus) => void
  ) => () => void;
  readonly onResetViewRequested: (callback: () => void) => () => void;
};

export type RuntimePlayerApi = {
  readonly runtimeExport: RuntimeExportApi;
  readonly input: RuntimePlayerInputApi;
  readonly inputProfile: RuntimePlayerInputProfileApi;
  readonly modelMapping: RuntimePlayerModelMappingApi;
  readonly liveParameters: RuntimePlayerLiveParameterApi;
  readonly stageView: RuntimePlayerStageViewApi;
  readonly getStartupStatus: () => Promise<RuntimePlayerStartupStatus>;
  readonly getStageStatus: () => Promise<RuntimePlayerStageStatus>;
  readonly performPlaceholderAction: (
    action: RuntimePlayerPlaceholderAction
  ) => Promise<RuntimePlayerPlaceholderResult>;
  readonly focusStage: () => Promise<RuntimePlayerPlaceholderResult>;
  readonly resetStagePosition: () => Promise<RuntimePlayerPlaceholderResult>;
};

declare global {
  interface Window {
    readonly runtimePlayer: RuntimePlayerApi;
  }
}
