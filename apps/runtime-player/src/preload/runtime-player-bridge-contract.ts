import type {
  RuntimeExportApi,
  RuntimeExportStatus
} from "./runtime-export-bridge-contract";
import type { RuntimePlayerBrowserSourceApi } from "./browser-source-status-contract";
import type {
  RuntimePlayerDynamicsTuningApi
} from "./dynamics-tuning-bridge-contract";
import type { RuntimePlayerInputApi } from "./input-bridge-contract";
import type { RuntimePlayerInputProfileApi } from "./input-profile-bridge-contract";
import type { RuntimePlayerLiveParameterApi } from "./live-parameter-bridge-contract";
import type { RuntimePlayerModelMappingApi } from "./model-mapping-bridge-contract";
import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "./performance-diagnostics-contract";
import type { RuntimePlayerVariantControllerApi } from "./runtime-variant-bridge-contract";

export const runtimePlayerStageWindowTitle = "Runtime Player Stage" as const;

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

export const runtimePlayerStageViewCoordinateSpace =
  "stage-viewport-px-v1" as const;

export type RuntimePlayerStageViewTransform = {
  readonly zoomScale: number;
  readonly pan: {
    readonly x: number;
    readonly y: number;
  };
  readonly coordinateSpace: typeof runtimePlayerStageViewCoordinateSpace;
};

export type RuntimePlayerStageMotionSettings = {
  readonly enabled: boolean;
  readonly horizontal: {
    readonly strengthPx: number;
    readonly limitPx: number;
    readonly invert: boolean;
  };
  readonly scale: {
    readonly strength: number;
    readonly limit: number;
    readonly invert: boolean;
  };
  readonly deadZone: number;
  readonly reaction: number;
};

export type RuntimePlayerStageMotionSettingsUpdate = {
  readonly enabled?: boolean;
  readonly horizontal?: Partial<RuntimePlayerStageMotionSettings["horizontal"]>;
  readonly scale?: Partial<RuntimePlayerStageMotionSettings["scale"]>;
  readonly deadZone?: number;
  readonly reaction?: number;
};

export type RuntimePlayerWindowBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type RuntimePlayerStageStatePersistenceStatus =
  | "saved"
  | "saving"
  | "save-failed";

export type RuntimePlayerStageStateSnapshot = {
  readonly stageWindow: {
    readonly windowState: "created" | "destroyed";
    readonly bounds: RuntimePlayerWindowBounds | null;
  };
  readonly stageView: {
    readonly renderStatus: RuntimePlayerStageViewStatus;
    readonly transform: RuntimePlayerStageViewTransform;
  };
  readonly stageMotion: {
    readonly settings: RuntimePlayerStageMotionSettings;
  };
  readonly persistence: {
    readonly status: RuntimePlayerStageStatePersistenceStatus;
    readonly statusLabel: string;
    readonly storageLabel: "window-state/runtime-player.json";
    readonly updatedAtIso: string;
    readonly warningMessages: readonly string[];
  };
  readonly capture: RuntimePlayerStageCaptureState;
};

export type RuntimePlayerStageViewActionResult = {
  readonly result: "ok" | "error";
  readonly message: string;
  readonly status: RuntimePlayerStageStateSnapshot;
  readonly atIso: string;
};

export type RuntimePlayerStageArrangeState = {
  readonly arrangeModeEnabled: boolean;
};

export type RuntimePlayerStageCaptureState = RuntimePlayerStageArrangeState & {
  readonly clickThroughEnabled: boolean;
  readonly alwaysOnTopEnabled: boolean;
  readonly windowTitle: typeof runtimePlayerStageWindowTitle;
  readonly background: "transparent";
  readonly stageUi: "hidden" | "arrange-overlay-visible";
};

export type RuntimePlayerStageViewApi = {
  readonly getStatus: () => Promise<RuntimePlayerStageViewStatus>;
  readonly getState: () => Promise<RuntimePlayerStageStateSnapshot>;
  readonly reportStatus: (
    status: RuntimePlayerStageViewStatusReport
  ) => Promise<RuntimePlayerStageViewStatus>;
  readonly reportViewTransform: (
    transform: RuntimePlayerStageViewTransform
  ) => Promise<RuntimePlayerStageStateSnapshot>;
  readonly focusStage: () => Promise<RuntimePlayerStageViewActionResult>;
  readonly resetView: () => Promise<RuntimePlayerStageViewActionResult>;
  readonly centerModel: () => Promise<RuntimePlayerStageViewActionResult>;
  readonly setArrangeMode: (
    enabled: boolean
  ) => Promise<RuntimePlayerStageViewActionResult>;
  readonly setClickThrough: (
    enabled: boolean
  ) => Promise<RuntimePlayerStageViewActionResult>;
  readonly setAlwaysOnTop: (
    enabled: boolean
  ) => Promise<RuntimePlayerStageViewActionResult>;
  readonly updateStageMotionSettings: (
    update: RuntimePlayerStageMotionSettingsUpdate
  ) => Promise<RuntimePlayerStageViewActionResult>;
  readonly copyWindowTitle: () => Promise<RuntimePlayerStageViewActionResult>;
  readonly getViewTransform: () => Promise<RuntimePlayerStageViewTransform>;
  readonly getRenderMetrics:
    () => Promise<RuntimePlayerStageRenderMetricsSnapshot | null>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerStageViewStatus) => void
  ) => () => void;
  readonly onStateChanged: (
    callback: (status: RuntimePlayerStageStateSnapshot) => void
  ) => () => void;
  readonly onRenderMetricsChanged: (
    callback: (snapshot: RuntimePlayerStageRenderMetricsSnapshot) => void
  ) => () => void;
  readonly onApplyViewTransformRequested: (
    callback: (transform: RuntimePlayerStageViewTransform) => void
  ) => () => void;
  readonly onResetViewRequested: (callback: () => void) => () => void;
};

export type RuntimePlayerApi = {
  readonly runtimeExport: RuntimeExportApi;
  readonly input: RuntimePlayerInputApi;
  readonly inputProfile: RuntimePlayerInputProfileApi;
  readonly modelMapping: RuntimePlayerModelMappingApi;
  readonly dynamicsTuning: RuntimePlayerDynamicsTuningApi;
  readonly variants: RuntimePlayerVariantControllerApi;
  readonly liveParameters: RuntimePlayerLiveParameterApi;
  readonly stageView: RuntimePlayerStageViewApi;
  readonly browserSource: RuntimePlayerBrowserSourceApi;
  readonly getStartupStatus: () => Promise<RuntimePlayerStartupStatus>;
  readonly getStageStatus: () => Promise<RuntimePlayerStageStatus>;
  readonly performPlaceholderAction: (
    action: RuntimePlayerPlaceholderAction
  ) => Promise<RuntimePlayerPlaceholderResult>;
  readonly focusStage: () => Promise<RuntimePlayerStageViewActionResult>;
  readonly resetStagePosition: () => Promise<RuntimePlayerStageViewActionResult>;
};

declare global {
  interface Window {
    readonly runtimePlayer: RuntimePlayerApi;
  }
}
