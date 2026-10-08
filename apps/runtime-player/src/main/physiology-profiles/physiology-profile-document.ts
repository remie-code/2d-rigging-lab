import type {
  PhysiologyToneOverrides
} from "../../preload/physiology-bridge-contract";
import {
  runtimePlayerPhysiologyProfileSchemaVersion
} from "../../preload/physiology-bridge-contract";

export const physiologyProfileSchemaVersion =
  runtimePlayerPhysiologyProfileSchemaVersion;

/**
 * The identity of the loaded Runtime Export for physiology-profile scoping. Unlike
 * Dynamics Tune, physiology carries NO `dynamicsSignatureHash` (裁定4): the knobs are
 * model-INDEPENDENT universal vocabulary, so「stale」means only「a DIFFERENT export」—
 * which the fingerprint path already separates — plus a schemaVersion reject. Two
 * slots (different userData roots) and two exports (different fingerprints) never
 * interfere.
 */
export type PhysiologyRuntimeExportIdentity = {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly safePackageId: string;
  readonly fingerprint: string;
};

/** The export identity actually persisted in the profile document (for a match). */
export type PhysiologyProfileExportIdentity = {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly fingerprint: string;
};

export type PhysiologyProfileDocument = {
  readonly schemaVersion: typeof physiologyProfileSchemaVersion;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly exportIdentity: PhysiologyProfileExportIdentity;
  readonly overrides: PhysiologyToneOverrides;
};
