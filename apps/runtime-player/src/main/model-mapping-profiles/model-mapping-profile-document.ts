import type {
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";

export const modelMappingProfileSchemaVersion =
  "runtime-player-model-mapping-profile-v1";

export const modelMappingProfileAutoMappingVersion = "body-follow-v1";

export type ModelMappingProfileExportIdentity = {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly parameterSignatureHash: string;
};

export type ModelMappingRuntimeExportIdentity =
  ModelMappingProfileExportIdentity & {
    readonly safePackageId: string;
    readonly fingerprint: string;
  };

export type ModelMappingProfileTarget = {
  readonly parameterId: string;
  readonly displayName: string;
  readonly projectPresetAlias?: string;
};

export type ModelMappingProfileSlot = {
  readonly slotId: RuntimePlayerMappingSlotId;
  readonly target: ModelMappingProfileTarget | null;
  readonly enabled: boolean;
  readonly invert: boolean;
  readonly strength: number;
  readonly smoothing?: number;
  readonly bodyRotationStrength?: number;
  readonly bodyRotationInvert?: boolean;
  readonly bodyPositionStrength?: number;
  readonly bodyPositionInvert?: boolean;
};

export type ModelMappingProfileDocument = {
  readonly schemaVersion: typeof modelMappingProfileSchemaVersion;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly exportIdentity: ModelMappingProfileExportIdentity;
  readonly autoMappingVersion: typeof modelMappingProfileAutoMappingVersion;
  readonly slots: readonly ModelMappingProfileSlot[];
  /**
   * Per-model vowel lipsync toggle (design §3.2). Optional so profiles written
   * before this field load unchanged; a missing value resolves to the default
   * (ON when the model resolved vowel targets). schemaVersion is held at v1
   * because this is a purely additive optional field.
   */
  readonly vowelLipsyncEnabled?: boolean;
};
