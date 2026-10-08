import { createHash } from "node:crypto";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  createParameterSignatureHash,
  createSafePackageId
} from "../model-mapping-profiles/model-mapping-export-identity";
import type {
  DynamicsTuningRuntimeExportIdentity
} from "./dynamics-tuning-profile-document";
import {
  createDynamicsTuningSignatureHash
} from "./dynamics-tuning-signature";

export function createDynamicsTuningRuntimeExportIdentity(
  payload: RuntimeExportLoadedPayload
): DynamicsTuningRuntimeExportIdentity {
  const sourcePackage = payload.artifacts.manifest.sourcePackage;
  const packageHash = normalizeOptionalString(sourcePackage.packageHash);
  const parameterSignatureHash = createParameterSignatureHash(payload);
  const dynamicsSignatureHash = createDynamicsTuningSignatureHash(payload);
  const exportIdentity = {
    packageId: sourcePackage.packageId,
    packageRevision: sourcePackage.packageRevision,
    ...(packageHash === undefined ? {} : { packageHash }),
    parameterSignatureHash
  };
  const fingerprint = packageHash === undefined
    ? `fallback-${sha256Hex(JSON.stringify({
        packageId: exportIdentity.packageId,
        packageRevision: exportIdentity.packageRevision,
        parameterSignatureHash
      }))}`
    : `package-hash-${sha256Hex(packageHash)}`;

  return {
    ...exportIdentity,
    safePackageId: createSafePackageId(sourcePackage.packageId),
    fingerprint,
    dynamicsSignatureHash
  };
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
