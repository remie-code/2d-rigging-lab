import type {
  RuntimePlayerDynamicsTuningExportIdentity,
  RuntimePlayerDynamicsTuningGroupOverride
} from "../../preload/dynamics-tuning-bridge-contract";
import {
  runtimePlayerDynamicsTuningProfileSchemaVersion
} from "../../preload/dynamics-tuning-bridge-contract";

export const dynamicsTuningProfileSchemaVersion =
  runtimePlayerDynamicsTuningProfileSchemaVersion;

export type DynamicsTuningRuntimeExportIdentity =
  RuntimePlayerDynamicsTuningExportIdentity & {
    readonly safePackageId: string;
    readonly fingerprint: string;
    readonly dynamicsSignatureHash: string;
  };

export type DynamicsTuningProfileDocument = {
  readonly schemaVersion: typeof dynamicsTuningProfileSchemaVersion;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly exportIdentity: RuntimePlayerDynamicsTuningExportIdentity;
  readonly dynamicsSignatureHash: string;
  readonly groups: Readonly<Record<string, RuntimePlayerDynamicsTuningGroupOverride>>;
};
