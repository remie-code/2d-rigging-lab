import { createHash } from "node:crypto";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { createSafePackageId } from "../model-mapping-profiles/model-mapping-export-identity";
import type {
  PhysiologyRuntimeExportIdentity
} from "./physiology-profile-document";

/**
 * Derive the physiology-profile scoping identity for a loaded Runtime Export. The
 * fingerprint is model-INDEPENDENT (裁定4): it identifies the EXPORT (packageHash,
 * or a fallback over packageId+revision), not its parameter/dynamics content — so a
 * profile carries over between re-loads of the same export and stays separated from
 * a different export by the fingerprint path alone.
 */
export function createPhysiologyRuntimeExportIdentity(
  payload: RuntimeExportLoadedPayload
): PhysiologyRuntimeExportIdentity {
  const sourcePackage = payload.artifacts.manifest.sourcePackage;
  const packageHash = normalizeOptionalString(sourcePackage.packageHash);
  const fingerprint =
    packageHash === undefined
      ? `fallback-${sha256Hex(
          JSON.stringify({
            packageId: sourcePackage.packageId,
            packageRevision: sourcePackage.packageRevision
          })
        )}`
      : `package-hash-${sha256Hex(packageHash)}`;

  return {
    packageId: sourcePackage.packageId,
    packageRevision: sourcePackage.packageRevision,
    ...(packageHash === undefined ? {} : { packageHash }),
    safePackageId: createSafePackageId(sourcePackage.packageId),
    fingerprint
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
