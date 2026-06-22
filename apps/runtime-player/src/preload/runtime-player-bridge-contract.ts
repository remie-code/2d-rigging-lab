import type {
  RuntimeExportApi,
  RuntimeExportStatus
} from "./runtime-export-bridge-contract";

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
  readonly handled: false;
  readonly message: string;
  readonly atIso: string;
};

export type RuntimePlayerApi = {
  readonly runtimeExport: RuntimeExportApi;
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
