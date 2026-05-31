import type {
  BinaryAssetIndexFileDto,
  PackageDocumentDto,
  PackageInMemoryFileSet
} from "@private-2d-rigging-lab/package-format";
import type { RuntimeSnapshotId } from "@private-2d-rigging-lab/contracts";

import { buildValidationReport, createDefaultEvidence } from "../report-builder.js";
import type { ValidationReportDto } from "../validation-report.js";
import { validateSourceAssetRightsAndProvenance } from "./asset-rights.js";
import { validatePackageBinaryAssets } from "./binary-assets.js";
import { validateDrawableProvenanceReferences } from "./drawable-provenance.js";
import { validateDrawableReferences } from "./drawable-references.js";
import { validatePackageSchema } from "./package-schema.js";
import { validatePsdSourceProfiles } from "./psd-source-profile.js";
import { validateRuntimeSnapshot } from "./runtime-load.js";
import { validateTextureAssetReferences } from "./texture-assets.js";

export interface PackageRuntimeValidationInput {
  readonly packageDocument: unknown;
  readonly runtimeSnapshot?: unknown;
  readonly profile?: string;
  readonly createdAt?: string;
}

export interface PackageRuntimeBinaryValidationInput extends PackageRuntimeValidationInput {
  readonly binaryFileSet?: PackageInMemoryFileSet;
  readonly binaryAssetIndex?: BinaryAssetIndexFileDto;
}

export const validatePackageRuntime = (input: PackageRuntimeValidationInput): ValidationReportDto => {
  const packageResult = validatePackageSchema(input.packageDocument);
  const runtimeResult =
    input.runtimeSnapshot === undefined
      ? undefined
      : validateRuntimeSnapshot(input.runtimeSnapshot, packageResult.packageId);
  const packageReferenceChecks = packageResult.packageDocument === undefined
    ? []
    : collectPackageReferenceChecks(packageResult.packageDocument);
  const runtimeSnapshotIds: RuntimeSnapshotId[] =
    runtimeResult?.snapshotId === undefined ? [] : [runtimeResult.snapshotId];

  return buildValidationReport({
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    packageId: packageResult.packageId,
    packageRevision: packageResult.packageRevision,
    profile: input.profile ?? "strict",
    checks: [...packageResult.checks, ...packageReferenceChecks, ...(runtimeResult?.checks ?? [])],
    evidence: createDefaultEvidence(runtimeSnapshotIds)
  });
};

export const validatePackageRuntimeWithBinaryAssets = async (
  input: PackageRuntimeBinaryValidationInput
): Promise<ValidationReportDto> => {
  const packageResult = validatePackageSchema(input.packageDocument);
  const runtimeResult =
    input.runtimeSnapshot === undefined
      ? undefined
      : validateRuntimeSnapshot(input.runtimeSnapshot, packageResult.packageId);
  const packageReferenceChecks = packageResult.packageDocument === undefined
    ? []
    : [
      ...collectPackageReferenceChecks(packageResult.packageDocument),
      ...(await validatePackageBinaryAssets({
        packageDocument: packageResult.packageDocument,
        binaryFileSet: input.binaryFileSet ?? [],
        ...(input.binaryAssetIndex === undefined ? {} : { binaryAssetIndex: input.binaryAssetIndex })
      }))
    ];
  const runtimeSnapshotIds: RuntimeSnapshotId[] =
    runtimeResult?.snapshotId === undefined ? [] : [runtimeResult.snapshotId];

  return buildValidationReport({
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    packageId: packageResult.packageId,
    packageRevision: packageResult.packageRevision,
    profile: input.profile ?? "strict",
    checks: [...packageResult.checks, ...packageReferenceChecks, ...(runtimeResult?.checks ?? [])],
    evidence: createDefaultEvidence(runtimeSnapshotIds)
  });
};

const collectPackageReferenceChecks = (
  packageDocument: PackageDocumentDto
) => [
  ...validatePsdSourceProfiles(packageDocument),
  ...validateSourceAssetRightsAndProvenance(packageDocument),
  ...validateDrawableProvenanceReferences(packageDocument),
  ...validateDrawableReferences(packageDocument),
  ...validateTextureAssetReferences(packageDocument)
];
