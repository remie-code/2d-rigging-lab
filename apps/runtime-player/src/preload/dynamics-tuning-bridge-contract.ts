export const runtimePlayerDynamicsTuningProfileSchemaVersion =
  "runtime-player-dynamics-tuning-profile-v2" as const;

export const runtimePlayerEffectiveDynamicsTuningSchemaVersion =
  "runtime-player-effective-dynamics-tuning-v1" as const;

export type RuntimePlayerDynamicsTuningExportIdentity = {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly parameterSignatureHash: string;
};

export type RuntimePlayerDynamicsTuningGroupOverride = {
  readonly enabled?: boolean;
  readonly outputScale?: number;
  readonly limit?: number;
  readonly damping?: number;
  readonly gravityScale?: number;
  readonly lengthScale?: number;
};

export type RuntimePlayerEffectiveDynamicsTuningProfile = {
  readonly schemaVersion:
    typeof runtimePlayerEffectiveDynamicsTuningSchemaVersion;
  readonly revision: number;
  readonly fingerprint: string;
  readonly updatedAtIso: string;
  readonly exportIdentity: RuntimePlayerDynamicsTuningExportIdentity;
  readonly dynamicsSignatureHash: string;
  readonly groups: Readonly<Record<string, RuntimePlayerDynamicsTuningGroupOverride>>;
};

export type RuntimePlayerDynamicsTuningValues = {
  readonly enabled: boolean;
  readonly outputScale: number;
  readonly limit: number;
  readonly damping: number;
  readonly gravityScale: number;
  readonly lengthScale: number;
};

export type RuntimePlayerDynamicsTuningParameterRef = {
  readonly parameterId: string;
  readonly kind: string;
  readonly displayName?: string;
};

export type RuntimePlayerDynamicsTuningGroupStatus = {
  readonly groupId: string;
  readonly displayName: string;
  readonly inputSummary: readonly RuntimePlayerDynamicsTuningParameterRef[];
  readonly outputSummary: readonly RuntimePlayerDynamicsTuningParameterRef[];
  readonly exportedValues: RuntimePlayerDynamicsTuningValues;
  readonly effectiveValues: RuntimePlayerDynamicsTuningValues;
  readonly override: RuntimePlayerDynamicsTuningGroupOverride | null;
  readonly hasOverride: boolean;
  readonly warningMessages: readonly string[];
};

export type RuntimePlayerDynamicsTuningRuntimeExportRef = {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly loadedAtIso: string;
  readonly modelDisplayName: string;
};

export type RuntimePlayerDynamicsTuningProfileStatusKind =
  | "unavailable"
  | "default"
  | "restored"
  | "stale"
  | "unsaved"
  | "saving"
  | "saved"
  | "save-failed"
  | "load-warning";

export type RuntimePlayerDynamicsTuningProfileStatus = {
  readonly kind: RuntimePlayerDynamicsTuningProfileStatusKind;
  readonly label: string;
  readonly warningMessages: readonly string[];
  readonly updatedAtIso?: string;
};

export type RuntimePlayerDynamicsTuningStatus = {
  readonly status: "unavailable" | "ready";
  readonly statusLabel: string;
  readonly runtimeExport: RuntimePlayerDynamicsTuningRuntimeExportRef | null;
  readonly profileStatus: RuntimePlayerDynamicsTuningProfileStatus;
  readonly groups: readonly RuntimePlayerDynamicsTuningGroupStatus[];
  readonly dynamicsGroupCount: number;
  readonly overriddenGroupCount: number;
  readonly dynamicsSignatureHash: string | null;
  readonly tuningRevision: number;
  readonly effectiveProfile: RuntimePlayerEffectiveDynamicsTuningProfile | null;
  readonly updatedAtIso: string;
};

export type RuntimePlayerDynamicsTuningGroupUpdateRequest = {
  readonly groupId: string;
} & RuntimePlayerDynamicsTuningGroupOverride;

export type RuntimePlayerDynamicsTuningGroupResetRequest = {
  readonly groupId: string;
};

export type RuntimePlayerDynamicsTuningActionResultKind =
  | "ok"
  | "unavailable"
  | "save-failed"
  | "validation-error";

export type RuntimePlayerDynamicsTuningActionResult = {
  readonly result: RuntimePlayerDynamicsTuningActionResultKind;
  readonly message: string;
  readonly status: RuntimePlayerDynamicsTuningStatus;
};

export type RuntimePlayerDynamicsTuningApi = {
  readonly getStatus: () => Promise<RuntimePlayerDynamicsTuningStatus>;
  readonly updateGroup: (
    request: RuntimePlayerDynamicsTuningGroupUpdateRequest
  ) => Promise<RuntimePlayerDynamicsTuningActionResult>;
  readonly resetGroup: (
    request: RuntimePlayerDynamicsTuningGroupResetRequest
  ) => Promise<RuntimePlayerDynamicsTuningActionResult>;
  readonly retryProfileSave: () => Promise<RuntimePlayerDynamicsTuningActionResult>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerDynamicsTuningStatus) => void
  ) => () => void;
};

export type RuntimePlayerStageDynamicsTuningApi = {
  readonly getEffectiveProfile:
    () => Promise<RuntimePlayerEffectiveDynamicsTuningProfile | null>;
  readonly onEffectiveProfileChanged: (
    callback: (
      profile: RuntimePlayerEffectiveDynamicsTuningProfile | null
    ) => void
  ) => () => void;
};
