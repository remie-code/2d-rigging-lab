import { createHash } from "node:crypto";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { createDirectTargetCandidates } from "../live-mapping/runtime-export-auto-mapping";
import type { ModelMappingRuntimeExportIdentity } from "./model-mapping-profile-document";

export function createModelMappingRuntimeExportIdentity(
  payload: RuntimeExportLoadedPayload
): ModelMappingRuntimeExportIdentity {
  const sourcePackage = payload.artifacts.manifest.sourcePackage;
  const packageHash = normalizeOptionalString(sourcePackage.packageHash);
  const parameterSignatureHash = createParameterSignatureHash(payload);
  const exportIdentity = {
    packageId: sourcePackage.packageId,
    packageRevision: sourcePackage.packageRevision,
    ...(packageHash === undefined ? {} : { packageHash }),
    parameterSignatureHash
  };
  const fingerprint = packageHash === undefined
    ? `fallback-${sha256Hex(stableStringify({
        packageId: exportIdentity.packageId,
        packageRevision: exportIdentity.packageRevision,
        parameterSignatureHash
      }))}`
    : `package-hash-${sha256Hex(packageHash)}`;

  return {
    ...exportIdentity,
    safePackageId: createSafePackageId(sourcePackage.packageId),
    fingerprint
  };
}

export function createParameterSignatureHash(
  payload: RuntimeExportLoadedPayload
): string {
  const signature = createDirectTargetCandidates(payload)
    .map((target) => ({
      parameterId: target.parameterId,
      projectPresetAlias: target.projectPresetAlias ?? null,
      displayName: target.displayName,
      min: target.min,
      max: target.max,
      default: target.default
    }))
    .sort((left, right) =>
      left.parameterId.localeCompare(right.parameterId)
    );

  return `sha256:${sha256Hex(stableStringify(signature))}`;
}

export function createSafePackageId(packageId: string): string {
  const safe = packageId
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  if (safe.length > 0 && safe === packageId) {
    return safe;
  }

  return `${safe.length === 0 ? "package" : safe}-${sha256Hex(packageId).slice(0, 12)}`;
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

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}
