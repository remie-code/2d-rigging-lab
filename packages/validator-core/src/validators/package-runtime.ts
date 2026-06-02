import type {
  BinaryAssetIndexFileDto,
  PackageDocumentDto,
  PackageInMemoryFileSet
} from "@private-2d-rigging-lab/package-format";
import type { RuntimeSnapshotId } from "@private-2d-rigging-lab/contracts";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

import { buildValidationReport, createDefaultEvidence } from "../report-builder.js";
import type { ValidationReportDto } from "../validation-report.js";
import { validateSourceAssetRightsAndProvenance } from "./asset-rights.js";
import {
  validateByteIntakePreflight,
  type ByteIntakePreflightInput
} from "./byte-intake-preflight.js";
import { validatePackageBinaryAssets } from "./binary-assets.js";
import { validateDrawableProvenanceReferences } from "./drawable-provenance.js";
import { validateDrawableReferences } from "./drawable-references.js";
import { validateDynamicsSemantics } from "./dynamics-semantic.js";
import { validateMaskCompositionSemantics } from "./mask-composition.js";
import { validateMeshSemantics } from "./mesh-semantics.js";
import { validatePackageSchema } from "./package-schema.js";
import { validatePartLayerSemantics } from "./part-layer-semantics.js";
import { validatePsdSourceProfiles } from "./psd-source-profile.js";
import { validateRigControlSemantics } from "./rig-control-semantic.js";
import { validateRuntimeSnapshot } from "./runtime-load.js";
import { validateTextureAssetReferences } from "./texture-assets.js";
import { validateViewerRuntimeEvidence } from "./viewer-evidence.js";
import type { ViewerRuntimeEvidenceValidationResult } from "./viewer-evidence.js";

export interface PackageRuntimeValidationInput {
  readonly packageDocument: unknown;
  readonly runtimeSnapshot?: unknown;
  readonly viewerEvidence?: unknown;
  readonly requireViewerEvidence?: boolean;
  readonly profile?: string;
  readonly createdAt?: string;
}

export interface PackageRuntimeBinaryValidationInput extends PackageRuntimeValidationInput {
  readonly binaryFileSet?: PackageInMemoryFileSet;
  readonly binaryAssetIndex?: BinaryAssetIndexFileDto;
  readonly byteIntakePreflight?: ByteIntakePreflightInput;
}

export const validatePackageRuntime = (input: PackageRuntimeValidationInput): ValidationReportDto => {
  const packageResult = validatePackageSchema(input.packageDocument);
  const runtimeResult =
    input.runtimeSnapshot === undefined
      ? undefined
      : validateRuntimeSnapshot(input.runtimeSnapshot, packageResult.packageId);
  const packageReferenceChecks = packageResult.packageDocument === undefined
    ? []
    : collectPackageReferenceChecks(
      packageResult.packageDocument,
      runtimeResult?.snapshot,
      shouldRequireViewerEvidence(input)
    );
  const viewerEvidenceResult = packageResult.packageDocument === undefined
    ? createEmptyViewerEvidenceValidationResult()
    : validateViewerRuntimeEvidence({
        packageDocument: packageResult.packageDocument,
        ...(runtimeResult?.snapshot === undefined ? {} : { runtimeSnapshot: runtimeResult.snapshot }),
        ...(input.viewerEvidence === undefined ? {} : { viewerEvidence: input.viewerEvidence }),
        requireViewerEvidence: shouldRequireViewerEvidence(input)
      });
  const runtimeSnapshotIds = mergeRuntimeSnapshotIds(
    viewerEvidenceResult.runtimeSnapshotIds,
    runtimeResult?.snapshotId
  );

  return buildValidationReport({
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    packageId: packageResult.packageId,
    packageRevision: packageResult.packageRevision,
    profile: input.profile ?? "strict",
    checks: [
      ...packageResult.checks,
      ...packageReferenceChecks,
      ...viewerEvidenceResult.checks,
      ...(runtimeResult?.checks ?? [])
    ],
    evidence: {
      ...createDefaultEvidence(runtimeSnapshotIds),
      supplementalGuiEvidenceRefs: [...viewerEvidenceResult.supplementalEvidenceRefs]
    }
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
      ...collectPackageReferenceChecks(
        packageResult.packageDocument,
        runtimeResult?.snapshot,
        shouldRequireViewerEvidence(input)
      ),
      ...(await validatePackageBinaryAssets({
        packageDocument: packageResult.packageDocument,
        binaryFileSet: input.binaryFileSet ?? [],
        ...(input.binaryAssetIndex === undefined ? {} : { binaryAssetIndex: input.binaryAssetIndex })
      })),
      ...(input.byteIntakePreflight === undefined
        ? []
        : await validateByteIntakePreflight(input.byteIntakePreflight))
    ];
  const viewerEvidenceResult = packageResult.packageDocument === undefined
    ? createEmptyViewerEvidenceValidationResult()
    : validateViewerRuntimeEvidence({
        packageDocument: packageResult.packageDocument,
        ...(runtimeResult?.snapshot === undefined ? {} : { runtimeSnapshot: runtimeResult.snapshot }),
        ...(input.viewerEvidence === undefined ? {} : { viewerEvidence: input.viewerEvidence }),
        requireViewerEvidence: shouldRequireViewerEvidence(input)
      });
  const runtimeSnapshotIds = mergeRuntimeSnapshotIds(
    viewerEvidenceResult.runtimeSnapshotIds,
    runtimeResult?.snapshotId
  );

  return buildValidationReport({
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    packageId: packageResult.packageId,
    packageRevision: packageResult.packageRevision,
    profile: input.profile ?? "strict",
    checks: [
      ...packageResult.checks,
      ...packageReferenceChecks,
      ...viewerEvidenceResult.checks,
      ...(runtimeResult?.checks ?? [])
    ],
    evidence: {
      ...createDefaultEvidence(runtimeSnapshotIds),
      supplementalGuiEvidenceRefs: [...viewerEvidenceResult.supplementalEvidenceRefs]
    }
  });
};

const collectPackageReferenceChecks = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot: RuntimeSnapshotDto | undefined,
  requireRuntimeEvidence = false
) => [
  ...validatePsdSourceProfiles(packageDocument),
  ...validateSourceAssetRightsAndProvenance(packageDocument),
  ...validateDrawableProvenanceReferences(packageDocument),
  ...validateDrawableReferences(packageDocument),
  ...validateMeshSemantics({
    packageDocument,
    ...(runtimeSnapshot === undefined ? {} : { runtimeSnapshot }),
    requireRuntimeEvidence
  }),
  ...validatePartLayerSemantics(packageDocument),
  ...validateTextureAssetReferences(packageDocument),
  ...validateMaskCompositionSemantics(packageDocument, runtimeSnapshot),
  ...validateRigControlSemantics(packageDocument, runtimeSnapshot),
  ...validateDynamicsSemantics(packageDocument, runtimeSnapshot)
];

const shouldRequireViewerEvidence = (input: PackageRuntimeValidationInput): boolean =>
  input.requireViewerEvidence === true || input.profile === "viewer";

const createEmptyViewerEvidenceValidationResult = (): ViewerRuntimeEvidenceValidationResult => ({
  checks: [],
  runtimeSnapshotIds: [],
  supplementalEvidenceRefs: []
});

const mergeRuntimeSnapshotIds = (
  viewerRuntimeSnapshotIds: readonly RuntimeSnapshotId[],
  runtimeSnapshotId?: RuntimeSnapshotId
): readonly RuntimeSnapshotId[] =>
  [...new Set([
    ...viewerRuntimeSnapshotIds,
    ...(runtimeSnapshotId === undefined ? [] : [runtimeSnapshotId])
  ])];
