import {
  createDryRunAuthoringSession,
  importSourceAssetMetadata
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  JsonValue,
  ModelDiffDto,
  OperationId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createProvenanceId } from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { createPsdAdapterResultOperationDiagnostics } from "./import-psd-source-asset-diagnostics.js";
import {
  collectPsdCheckedPartIds,
  collectPsdImportTargetIds,
  createPsdSourceAssetFromPayload,
  normalizePsdPackageRelativePath,
  resolvePsdContentHash,
  resolvePsdSourceAssetId,
  type PsdSourceAsset
} from "./import-psd-source-asset-materialization.js";
import { evaluateImportPsdSourceAssetPreconditions } from "./import-psd-source-asset-preconditions.js";
import {
  materializePsdLayerTexturePreviewMetadata,
  type PsdTextureMaterializationResult
} from "./import-psd-source-asset-texture.js";

export const importPsdSourceAssetOperationHandler: OperationHandler = {
  operationType: "importPsdSourceAsset",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyImportPsdSourceAsset(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyImportPsdSourceAsset(session, request, operationId, "committed");
  }
};

const applyImportPsdSourceAsset = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "importPsdSourceAsset") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.importPsdSourceAsset.unsupportedPayload",
            message: `importPsdSourceAsset handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const sourceAssetId = resolvePsdSourceAssetId(request.payload);
  const sourceTarget: TargetRefDto = { kind: "sourceAsset", id: sourceAssetId };
  const targetIds = collectPsdImportTargetIds(request.payload, sourceAssetId);
  const preconditionDiagnostics = evaluateImportPsdSourceAssetPreconditions({
    session,
    request,
    sourceAssetId
  });

  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const adapterResult = request.payload.adapterResult;
  const packageRelativePath = normalizePsdPackageRelativePath(
    request.payload.fileRef.packageRelativePath
  );
  if (adapterResult === undefined || packageRelativePath === undefined) {
    throw new Error("Expected importPsdSourceAsset preconditions to reject missing adapter result or source path.");
  }

  const baseRevision = session.authoringRevision;
  const provenanceId = createProvenanceId(operationId);
  const contentHash = resolvePsdContentHash(request.payload, sourceAssetId);
  const sourceAsset = createPsdSourceAssetFromPayload({
    payload: request.payload,
    sourceAssetId,
    packageRelativePath,
    contentHash
  });
  const provenanceRecord: ProvenanceRecord = {
    provenanceId,
    assetId: sourceAssetId,
    assetKind: "source",
    filePath: packageRelativePath,
    contentHash,
    creator: request.payload.rights.creator,
    license: request.payload.rights.license,
    redistributionAllowed: request.payload.rights.redistributionAllowed,
    aiUsed: request.payload.rights.aiUsed,
    transformHistory: [
      "importPsdSourceAsset:adapter-result-metadata",
      `psdAdapter:${adapterResult.adapterName}`,
      `psdAdapterSchema:${adapterResult.schemaVersion}`
    ],
    relatedOperationIds: [operationId]
  };
  const rightsRecord: RightsRecord = {
    assetId: sourceAssetId,
    rightsStatus: "cleared",
    license: request.payload.rights.license,
    redistributionAllowed: request.payload.rights.redistributionAllowed
  };
  const mutation = importSourceAssetMetadata(session, {
    sourceAsset,
    provenanceRecord,
    rightsRecord
  });
  const textureMaterializations = materializePsdLayerTexturePreviewMetadata({
    session,
    payload: request.payload,
    sourceAssetId,
    provenanceId
  });

  return {
    result: createImportPsdSourceAssetResult({
      operationId,
      status,
      baseRevision,
      candidateRevision:
        textureMaterializations.at(-1)?.authoringRevision ?? mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      sourceTarget,
      sourceAsset: mutation.sourceAsset,
      provenanceRecord: mutation.provenanceRecord,
      rightsRecord: mutation.rightsRecord,
      textureMaterializations,
      diagnostics: createPsdAdapterResultOperationDiagnostics({
        adapterResult,
        sourceAssetId
      }),
      checkedPartIds: collectPsdCheckedPartIds(adapterResult)
    }),
    targetIds,
    candidateSession: session
  };
};

const createImportPsdSourceAssetResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly sourceTarget: TargetRefDto;
  readonly sourceAsset: PsdSourceAsset;
  readonly provenanceRecord: ProvenanceRecord;
  readonly rightsRecord: RightsRecord;
  readonly textureMaterializations: readonly PsdTextureMaterializationResult[];
  readonly diagnostics: readonly DiagnosticDto[];
  readonly checkedPartIds: readonly string[];
}): OperationResultDto => {
  const packageTarget: TargetRefDto = { kind: "package", id: input.packageId };
  const textureTargets = input.textureMaterializations.map((materialization) => ({
    kind: "texture" as const,
    id: materialization.textureEntry.textureId
  }));
  const partTargets = input.checkedPartIds.map((partId) => ({
    kind: "part" as const,
    id: partId
  }));
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [input.sourceTarget],
    removed: [],
    changed: [
      {
        target: packageTarget,
        fields: [
          {
            path: "/assets/sourceManifest/sourceAssets",
            before: null,
            after: input.sourceAsset.sourceAssetId
          },
          {
            path: "/assets/provenance/records",
            before: null,
            after: input.provenanceRecord.provenanceId
          },
          {
            path: "/assets/rights/records",
            before: null,
            after: input.rightsRecord.assetId
          },
          ...input.textureMaterializations.flatMap((materialization) => [
            {
              path: "/assets/textureAtlas/textures",
              before: null,
              after: materialization.textureEntry.textureId
            },
            {
              path: "/assets/textureAtlas/previewAssets",
              before: null,
              after: materialization.previewAsset.previewAssetId
            }
          ])
        ]
      },
      {
        target: input.sourceTarget,
        fields: [
          {
            path: `/assets/sourceManifest/sourceAssets/${input.sourceAsset.sourceAssetId}`,
            before: null,
            after: toJsonValue(input.sourceAsset)
          },
          {
            path: "/assets/provenance/records",
            before: null,
            after: toJsonValue(input.provenanceRecord)
          },
          {
            path: "/assets/rights/records",
            before: null,
            after: toJsonValue(input.rightsRecord)
          },
          ...input.textureMaterializations.flatMap((materialization) => [
            {
              path: `/assets/textureAtlas/textures/${materialization.textureEntry.textureId}`,
              before: null,
              after: toJsonValue(materialization.textureEntry)
            },
            {
              path: `/assets/textureAtlas/previewAssets/${materialization.previewAsset.previewAssetId}`,
              before: null,
              after: toJsonValue(materialization.previewAsset)
            }
          ])
        ]
      }
    ],
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult(
      [],
      [input.sourceTarget, packageTarget, ...textureTargets, ...partTargets]
    ),
    modelDiff,
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: input.diagnostics,
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    reversible: true
  });
};

const toJsonValue = (value: unknown): JsonValue =>
  JSON.parse(JSON.stringify(value)) as JsonValue;

type ProvenanceRecord = AuthoringSession["graph"]["provenanceRecords"][number];
type RightsRecord = AuthoringSession["graph"]["rightsRecords"][number];
