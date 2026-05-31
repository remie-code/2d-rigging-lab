import {
  getPartById,
  getSourceAssetById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  OperationId,
  SourceAssetId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createProvenanceId } from "../operation-ids.js";
import type {
  ImportPsdSourceAssetPayloadDto,
  PsdAdapterResultDto
} from "../payloads/import-source.js";
import type { OperationRequestDto } from "../operation-request.js";
import { createOperationDiagnostic } from "../preconditions.js";
import { evaluateSourceBinaryAssetReferencePreconditions } from "./import-binary-asset-references.js";
import { createGroupPayloadPath } from "./import-psd-source-asset-diagnostics.js";
import { normalizePsdPackageRelativePath } from "./import-psd-source-asset-materialization.js";
import {
  createLayerPayloadPath,
  evaluatePsdLayerTextureMappingPreconditions,
  evaluatePsdTargetPartMappingPreconditions
} from "./import-psd-source-asset-texture.js";

type ImportPsdSourceAssetRequest = Extract<
  OperationRequestDto,
  { operationType: "importPsdSourceAsset" }
>;

export const evaluateImportPsdSourceAssetPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly request: ImportPsdSourceAssetRequest;
  readonly operationId: OperationId;
  readonly sourceAssetId: SourceAssetId;
}): DiagnosticDto[] => {
  const sourceTarget: TargetRefDto = { kind: "sourceAsset", id: input.sourceAssetId };
  const adapterResult = input.request.payload.adapterResult;
  const expectedProvenanceId = createProvenanceId(input.operationId);

  if (adapterResult === undefined) {
    return [
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.missingAdapterResult",
        message: "PSD source import requires a parser-free adapter result because operation-core does not parse PSD bytes or extract raster data.",
        target: { ...sourceTarget, path: "/payload/adapterResult" }
      })
    ];
  }

  const diagnostics: DiagnosticDto[] = [];

  if (normalizePsdPackageRelativePath(input.request.payload.fileRef.packageRelativePath) === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.missingSourcePath",
        message: "PSD source import requires a package-relative source file path.",
        target: { ...sourceTarget, path: "/payload/fileRef/packageRelativePath" }
      })
    );
  }

  diagnostics.push(
    ...evaluateSourceBinaryAssetReferencePreconditions({
      operationCheckIdPrefix: "operation.importPsdSourceAsset",
      sourceTarget,
      expectedPackageRelativePath: normalizePsdPackageRelativePath(
        input.request.payload.fileRef.packageRelativePath
      ),
      expectedProvenanceId,
      expectedRightsAssetId: input.sourceAssetId,
      binaryAssetRef: input.request.payload.fileRef.binaryAssetRef,
      payloadPath: "/payload/fileRef/binaryAssetRef"
    })
  );

  if (adapterResult.sourceProfile !== input.request.payload.importProfile) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.adapterProfileMismatch",
        message: `PSD adapter source profile ${adapterResult.sourceProfile} does not match import profile ${input.request.payload.importProfile}.`,
        target: { ...sourceTarget, path: "/payload/adapterResult/sourceProfile" }
      })
    );
  }

  if (getSourceAssetById(input.session.graph, input.sourceAssetId) !== undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.duplicateSourceAsset",
        message: `Source asset already exists: ${input.sourceAssetId}.`,
        target: sourceTarget
      })
    );
  }

  if (adapterResult.sourceLayers.length === 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.missingSourceLayers",
        message: "PSD adapter result requires at least one source layer metadata entry.",
        target: { ...sourceTarget, path: "/payload/adapterResult/sourceLayers" }
      })
    );
  }

  diagnostics.push(
    ...evaluateGroupMetadataPreconditions({
      session: input.session,
      adapterResult,
      sourceTarget
    })
  );
  diagnostics.push(
    ...evaluateLayerMetadataPreconditions({
      session: input.session,
      payload: input.request.payload,
      sourceTarget,
      expectedProvenanceId,
      expectedRightsAssetId: input.sourceAssetId
    })
  );
  diagnostics.push(
    ...evaluateRequestedLayerRolePreconditions({
      payload: input.request.payload,
      sourceTarget
    })
  );

  return diagnostics;
};

const evaluateGroupMetadataPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly adapterResult: PsdAdapterResultDto;
  readonly sourceTarget: TargetRefDto;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];
  const seenGroupIds = new Set<string>();
  const groupIds = new Set(input.adapterResult.sourceGroups.map((group) => group.sourceGroupId));

  for (const group of input.adapterResult.sourceGroups) {
    const groupPath = createGroupPayloadPath(group.sourceGroupId);
    if (seenGroupIds.has(group.sourceGroupId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.importPsdSourceAsset.duplicateSourceGroup",
          message: `PSD source group appears more than once: ${group.sourceGroupId}.`,
          target: { ...input.sourceTarget, path: groupPath }
        })
      );
    }

    seenGroupIds.add(group.sourceGroupId);

    if (group.parentGroupId !== undefined && !groupIds.has(group.parentGroupId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.importPsdSourceAsset.missingParentGroup",
          message: `PSD source group ${group.sourceGroupId} references missing parent group ${group.parentGroupId}.`,
          target: { ...input.sourceTarget, path: `${groupPath}/parentGroupId` }
        })
      );
    }

    if (
      group.targetPartId !== undefined &&
      getPartById(input.session.graph, group.targetPartId) === undefined
    ) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.importPsdSourceAsset.missingGroupTargetPart",
          message: `PSD source group target part does not exist: ${group.targetPartId}.`,
          target: { kind: "part", id: group.targetPartId, path: `${groupPath}/targetPartId` }
        })
      );
    }
  }

  return diagnostics;
};

const evaluateLayerMetadataPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly payload: ImportPsdSourceAssetPayloadDto;
  readonly sourceTarget: TargetRefDto;
  readonly expectedProvenanceId: ReturnType<typeof createProvenanceId>;
  readonly expectedRightsAssetId: SourceAssetId;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];
  const adapterResult = input.payload.adapterResult;
  if (adapterResult === undefined) {
    return diagnostics;
  }

  const seenLayerIds = new Set<string>();
  const seenTextureIds = new Set<string>();
  const groupIds = new Set(adapterResult.sourceGroups.map((group) => group.sourceGroupId));

  for (const layer of adapterResult.sourceLayers) {
    if (seenLayerIds.has(layer.sourceLayerId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.importPsdSourceAsset.duplicateSourceLayer",
          message: `PSD source layer appears more than once: ${layer.sourceLayerId}.`,
          target: { ...input.sourceTarget, path: createLayerPayloadPath(layer.sourceLayerId) }
        })
      );
    }

    seenLayerIds.add(layer.sourceLayerId);

    if (layer.parentGroupId !== undefined && !groupIds.has(layer.parentGroupId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.importPsdSourceAsset.missingParentGroup",
          message: `PSD source layer ${layer.sourceLayerId} references missing parent group ${layer.parentGroupId}.`,
          target: {
            ...input.sourceTarget,
            path: `${createLayerPayloadPath(layer.sourceLayerId)}/parentGroupId`
          }
        })
      );
    }

    diagnostics.push(
      ...evaluatePsdTargetPartMappingPreconditions({
        session: input.session,
        layer,
        sourceTarget: input.sourceTarget
      })
    );
    diagnostics.push(
      ...evaluatePsdLayerTextureMappingPreconditions({
        session: input.session,
        layer,
        seenTextureIds,
        sourceTarget: input.sourceTarget,
        expectedProvenanceId: input.expectedProvenanceId,
        expectedRightsAssetId: input.expectedRightsAssetId
      })
    );
  }

  return diagnostics;
};

const evaluateRequestedLayerRolePreconditions = (input: {
  readonly payload: ImportPsdSourceAssetPayloadDto;
  readonly sourceTarget: TargetRefDto;
}): DiagnosticDto[] => {
  const adapterResult = input.payload.adapterResult;
  if (adapterResult === undefined) {
    return [];
  }

  const sourceLayerIds = new Set(adapterResult.sourceLayers.map((layer) => layer.sourceLayerId));
  return Object.keys(input.payload.requestedLayerRoles)
    .filter((sourceLayerId) => !sourceLayerIds.has(sourceLayerId))
    .map((sourceLayerId) =>
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.unknownRequestedLayerRole",
        message: `requestedLayerRoles references a PSD source layer that is not present in the adapter result: ${sourceLayerId}.`,
        target: { ...input.sourceTarget, path: `/payload/requestedLayerRoles/${sourceLayerId}` }
      })
    );
};
