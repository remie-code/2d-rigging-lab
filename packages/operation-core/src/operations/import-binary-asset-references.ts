import type { BinaryAssetReferenceDto } from "@private-2d-rigging-lab/authoring-core";
import type {
  CheckStatus,
  DiagnosticDto,
  ProvenanceId,
  SourceAssetId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createOperationDiagnostic } from "../preconditions.js";

export const resolveBinaryBackedTexturePreviewReference = (input: {
  readonly texturePreviewReference: string | undefined;
  readonly texturePreviewBinaryAssetRef: BinaryAssetReferenceDto | undefined;
}): string | undefined =>
  input.texturePreviewReference ?? input.texturePreviewBinaryAssetRef?.packageRelativePath;

export const evaluateSourceBinaryAssetReferencePreconditions = (input: {
  readonly operationCheckIdPrefix: string;
  readonly sourceTarget: TargetRefDto;
  readonly expectedPackageRelativePath: string | undefined;
  readonly expectedProvenanceId: ProvenanceId;
  readonly expectedRightsAssetId: string;
  readonly binaryAssetRef: BinaryAssetReferenceDto | undefined;
  readonly payloadPath: string;
}): DiagnosticDto[] => {
  if (input.binaryAssetRef === undefined) {
    return [];
  }

  const diagnostics: DiagnosticDto[] = [];

  if (
    input.expectedPackageRelativePath !== undefined &&
    input.binaryAssetRef.packageRelativePath !== input.expectedPackageRelativePath
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: `${input.operationCheckIdPrefix}.sourceBinaryAssetRefPathMismatch`,
        message: `Source binary asset ${input.binaryAssetRef.binaryAssetId} points to ${input.binaryAssetRef.packageRelativePath}, not source file ${input.expectedPackageRelativePath}.`,
        target: { ...input.sourceTarget, path: input.payloadPath }
      })
    );
  }

  if (input.binaryAssetRef.provenanceId !== input.expectedProvenanceId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: `${input.operationCheckIdPrefix}.sourceBinaryAssetRefProvenanceMismatch`,
        message: `Source binary asset ${input.binaryAssetRef.binaryAssetId} uses provenance ${input.binaryAssetRef.provenanceId}, not ${input.expectedProvenanceId}.`,
        target: { ...input.sourceTarget, path: input.payloadPath }
      })
    );
  }

  if (input.binaryAssetRef.rightsAssetId !== input.expectedRightsAssetId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: `${input.operationCheckIdPrefix}.sourceBinaryAssetRefRightsMismatch`,
        message: `Source binary asset ${input.binaryAssetRef.binaryAssetId} uses rights asset ${input.binaryAssetRef.rightsAssetId}, not ${input.expectedRightsAssetId}.`,
        target: { ...input.sourceTarget, path: input.payloadPath }
      })
    );
  }

  return diagnostics;
};

export const evaluateTextureBinaryAssetReferencePreconditions = (input: {
  readonly operationCheckIdPrefix: string;
  readonly sourceTarget: TargetRefDto;
  readonly sourceLayerId: string;
  readonly texturePreviewReference: string | undefined;
  readonly texturePreviewBinaryAssetRef: BinaryAssetReferenceDto | undefined;
  readonly expectedProvenanceId: ProvenanceId;
  readonly expectedRightsAssetId: string;
  readonly payloadPath: string;
}): DiagnosticDto[] => {
  if (input.texturePreviewBinaryAssetRef === undefined) {
    return [];
  }

  const diagnostics: DiagnosticDto[] = [];

  if (!input.texturePreviewBinaryAssetRef.packageRelativePath.startsWith("assets/textures/")) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: `${input.operationCheckIdPrefix}.textureBinaryAssetRefPathUnsupported`,
        message: `Texture binary asset ${input.texturePreviewBinaryAssetRef.binaryAssetId} must point under assets/textures for layer ${input.sourceLayerId}.`,
        target: { ...input.sourceTarget, path: input.payloadPath }
      })
    );
  }

  if (
    input.texturePreviewReference !== undefined &&
    input.texturePreviewReference !== input.texturePreviewBinaryAssetRef.packageRelativePath
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: `${input.operationCheckIdPrefix}.textureBinaryAssetRefPathMismatch`,
        message: `Texture binary asset ${input.texturePreviewBinaryAssetRef.binaryAssetId} points to ${input.texturePreviewBinaryAssetRef.packageRelativePath}, not texture preview ${input.texturePreviewReference}.`,
        target: { ...input.sourceTarget, path: input.payloadPath }
      })
    );
  }

  if (input.texturePreviewBinaryAssetRef.provenanceId !== input.expectedProvenanceId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: `${input.operationCheckIdPrefix}.textureBinaryAssetRefProvenanceMismatch`,
        message: `Texture binary asset ${input.texturePreviewBinaryAssetRef.binaryAssetId} uses provenance ${input.texturePreviewBinaryAssetRef.provenanceId}, not ${input.expectedProvenanceId}.`,
        target: { ...input.sourceTarget, path: input.payloadPath }
      })
    );
  }

  if (input.texturePreviewBinaryAssetRef.rightsAssetId !== input.expectedRightsAssetId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: `${input.operationCheckIdPrefix}.textureBinaryAssetRefRightsMismatch`,
        message: `Texture binary asset ${input.texturePreviewBinaryAssetRef.binaryAssetId} uses rights asset ${input.texturePreviewBinaryAssetRef.rightsAssetId}, not ${input.expectedRightsAssetId}.`,
        target: { ...input.sourceTarget, path: input.payloadPath }
      })
    );
  }

  return diagnostics;
};

export const createPendingBinaryAssetReferenceDiagnostics = (input: {
  readonly checkId: string;
  readonly sourceAssetId: SourceAssetId;
  readonly references: readonly PendingBinaryAssetReferenceInput[];
}): DiagnosticDto[] =>
  input.references.flatMap((reference) => {
    if (reference.binaryAssetRef.storageStatus === "stored-package-local-v1") {
      return [];
    }

    return [
      createBinaryAssetReferenceDiagnostic({
        checkId: input.checkId,
        sourceAssetId: input.sourceAssetId,
        ...reference
      })
    ];
  });

export interface PendingBinaryAssetReferenceInput {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly targetPath: string;
  readonly label: string;
}

const createBinaryAssetReferenceDiagnostic = (input: {
  readonly checkId: string;
  readonly sourceAssetId: SourceAssetId;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly targetPath: string;
  readonly label: string;
}): DiagnosticDto => ({
  checkId: input.checkId as DiagnosticDto["checkId"],
  status: mapStorageStatusToCheckStatus(input.binaryAssetRef.storageStatus),
  severity: "warning",
  phase: "operation.import.binaryAssetRef",
  target: {
    kind: "sourceAsset",
    id: input.sourceAssetId,
    path: input.targetPath
  },
  message: `${input.label} binary payload is ${describeStorageStatus(input.binaryAssetRef.storageStatus)}; metadata remains package-local but bytes are not verified by operation-core.`,
  evidence: [
    `binaryAssetId:${input.binaryAssetRef.binaryAssetId}`,
    `packageRelativePath:${input.binaryAssetRef.packageRelativePath}`,
    `storageStatus:${input.binaryAssetRef.storageStatus}`,
    `mediaType:${input.binaryAssetRef.mediaType}`,
    `byteLength:${input.binaryAssetRef.byteLength}`,
    `digest:${input.binaryAssetRef.digest.algorithm}:${input.binaryAssetRef.digest.hex}`
  ],
  relatedAC: [],
  relatedScenarios: [],
  repairCandidateIds: []
});

const mapStorageStatusToCheckStatus = (
  storageStatus: BinaryAssetReferenceDto["storageStatus"]
): CheckStatus =>
  storageStatus === "missing-package-local-bytes-v1" ? "needs_review" : "warning";

const describeStorageStatus = (
  storageStatus: BinaryAssetReferenceDto["storageStatus"]
): string => {
  switch (storageStatus) {
    case "missing-package-local-bytes-v1":
      return "missing from the current package-local file set";
    case "storage-unsupported-v1":
      return "not materialized because this workflow does not support binary storage";
    case "stored-package-local-v1":
      return "declared as stored package-local bytes";
  }
};
