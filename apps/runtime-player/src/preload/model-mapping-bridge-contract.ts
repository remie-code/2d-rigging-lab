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
  "mouth-vowel-a",
  "mouth-vowel-i",
  "mouth-vowel-u",
  "mouth-vowel-e",
  "mouth-vowel-o",
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

export type RuntimePlayerMappingProfileStatusKind =
  | "unavailable"
  | "auto-mapped"
  | "restored"
  | "stale"
  | "unsaved"
  | "saving"
  | "saved"
  | "save-failed"
  | "load-warning";

export type RuntimePlayerMappingProfileStatus = {
  readonly kind: RuntimePlayerMappingProfileStatusKind;
  readonly label: string;
  readonly warningMessages: readonly string[];
  readonly updatedAtIso?: string;
};

export type RuntimePlayerMappingStatus = {
  readonly status: "unavailable" | "ready";
  readonly statusLabel: string;
  readonly runtimeExport: RuntimePlayerMappingRuntimeExportRef | null;
  readonly profileStatus: RuntimePlayerMappingProfileStatus;
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly mappedSlotCount: number;
  readonly enabledSlotCount: number;
  readonly missingSlotCount: number;
  /**
   * Whether vowel lipsync estimation is active for this model (design §3.2).
   * When false the estimator is short-circuited and no vowel parameterId is
   * emitted. `vowelLipsyncSupported` is true only when the model resolved vowel
   * targets, which drives whether the toggle is shown/actionable.
   */
  readonly vowelLipsyncSupported: boolean;
  readonly vowelLipsyncEnabled: boolean;
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
  | "save-failed"
  | "validation-error";

export type RuntimePlayerMappingActionResult = {
  readonly result: RuntimePlayerMappingActionResultKind;
  readonly message: string;
  readonly status: RuntimePlayerMappingStatus;
};

export type RuntimePlayerMappingVowelLipsyncUpdateRequest = {
  readonly enabled: boolean;
};

export type RuntimePlayerModelMappingApi = {
  readonly getStatus: () => Promise<RuntimePlayerMappingStatus>;
  readonly regenerateAutoMapping: () => Promise<RuntimePlayerMappingActionResult>;
  readonly resetToAutoMap: () => Promise<RuntimePlayerMappingActionResult>;
  readonly retryProfileSave: () => Promise<RuntimePlayerMappingActionResult>;
  readonly updateSlot: (
    request: RuntimePlayerMappingSlotUpdateRequest
  ) => Promise<RuntimePlayerMappingActionResult>;
  readonly setVowelLipsyncEnabled: (
    request: RuntimePlayerMappingVowelLipsyncUpdateRequest
  ) => Promise<RuntimePlayerMappingActionResult>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerMappingStatus) => void
  ) => () => void;
};
