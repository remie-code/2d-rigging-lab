export const runtimePlayerMappingSlotIds = [
  "head-horizontal",
  "head-vertical",
  "head-tilt",
  "eye-blink-left",
  "eye-blink-right",
  "gaze-horizontal",
  "gaze-vertical",
  "mouth-open",
  "mouth-smile",
  "body-x",
  "body-z"
] as const;

export type RuntimePlayerMappingSlotId =
  (typeof runtimePlayerMappingSlotIds)[number];

export type RuntimePlayerMappingSlotGroup = "head" | "eyes" | "mouth" | "body";

export type RuntimePlayerMappingTarget = {
  readonly parameterId: string;
  readonly displayName: string;
  readonly projectPresetAlias?: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
};

export type RuntimePlayerMappingSlotStatusKind =
  | "mapped"
  | "disabled"
  | "missing-target";

export type RuntimePlayerMappingSlot = {
  readonly slotId: RuntimePlayerMappingSlotId;
  readonly label: string;
  readonly group: RuntimePlayerMappingSlotGroup;
  readonly target: RuntimePlayerMappingTarget | null;
  readonly enabled: boolean;
  readonly invert: boolean;
  readonly strength: number;
  readonly smoothing?: number;
  readonly bodyRotationStrength?: number;
  readonly bodyPositionStrength?: number;
  readonly bodyRotationInvert?: boolean;
  readonly bodyPositionInvert?: boolean;
  readonly status: RuntimePlayerMappingSlotStatusKind;
  readonly warningMessages: readonly string[];
};

export type RuntimePlayerMappingRuntimeExportRef = {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly loadedAtIso: string;
  readonly modelDisplayName: string;
};

export type RuntimePlayerMappingStatus = {
  readonly status: "unavailable" | "ready";
  readonly statusLabel: string;
  readonly runtimeExport: RuntimePlayerMappingRuntimeExportRef | null;
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly mappedSlotCount: number;
  readonly enabledSlotCount: number;
  readonly missingSlotCount: number;
  readonly updatedAtIso: string;
};

export type RuntimePlayerMappingSlotUpdateRequest = {
  readonly slotId: RuntimePlayerMappingSlotId;
  readonly enabled?: boolean;
  readonly invert?: boolean;
  readonly strength?: number;
  readonly smoothing?: number;
  readonly bodyRotationStrength?: number;
  readonly bodyPositionStrength?: number;
  readonly bodyRotationInvert?: boolean;
  readonly bodyPositionInvert?: boolean;
};

export type RuntimePlayerMappingActionResultKind =
  | "ok"
  | "unavailable"
  | "validation-error";

export type RuntimePlayerMappingActionResult = {
  readonly result: RuntimePlayerMappingActionResultKind;
  readonly message: string;
  readonly status: RuntimePlayerMappingStatus;
};

export type RuntimePlayerModelMappingApi = {
  readonly getStatus: () => Promise<RuntimePlayerMappingStatus>;
  readonly regenerateAutoMapping: () => Promise<RuntimePlayerMappingActionResult>;
  readonly updateSlot: (
    request: RuntimePlayerMappingSlotUpdateRequest
  ) => Promise<RuntimePlayerMappingActionResult>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerMappingStatus) => void
  ) => () => void;
};
