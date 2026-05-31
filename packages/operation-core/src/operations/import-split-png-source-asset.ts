import {
  createDryRunAuthoringSession,
  getPartById,
  getSourceAssetById,
  importSourceAssetMetadata
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  SourceAssetIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DiagnosticDto,
  JsonValue,
  ModelDiffDto,
  OperationId,
  ProvenanceId,
  SourceAssetId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createProvenanceId } from "../operation-ids.js";
import type {
  SplitPngSourceAssetPayloadDto,
  SplitPngSourceLayerMetadataDto
} from "../payloads/import-source.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import {
  evaluateSourceBinaryAssetReferencePreconditions
} from "./import-binary-asset-references.js";
import {
  createSplitPngBinaryAssetReferenceOperationDiagnostics,
  createSplitPngSourceAssetDiagnostics
} from "./import-split-png-source-asset-diagnostics.js";
import {
  evaluateSplitPngLayerTextureMappingPreconditions,
  materializeSplitPngLayerTexturePreviewMetadata,
  splitPngLayerRequestsTextureMaterialization,
  type SplitPngTextureMaterializationResult
} from "./import-split-png-source-asset-texture.js";

export const importSplitPngSourceAssetOperationHandler: OperationHandler = {
  operationType: "importSplitPngSourceAsset",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyImportSplitPngSourceAsset(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyImportSplitPngSourceAsset(session, request, operationId, "committed");
  }
};

const applyImportSplitPngSourceAsset = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "importSplitPngSourceAsset") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.importSplitPngSourceAsset.unsupportedPayload",
            message: `importSplitPngSourceAsset handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const sourceAssetId = resolveSourceAssetId(request.payload);
  const sourceTarget: TargetRefDto = { kind: "sourceAsset", id: sourceAssetId };
  const targetIds = collectImportTargetIds(request.payload, sourceAssetId);
  const preconditionDiagnostics = evaluateImportSplitPngSourceAssetPreconditions({
    session,
    request,
    operationId,
    sourceAssetId
  });

  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const manifestPath = normalizeManifestPath(request.payload.manifestPath);
  const rightsMetadata = request.payload.rights;
  const provenanceMetadata = request.payload.provenance;
  if (manifestPath === undefined || rightsMetadata === undefined || provenanceMetadata === undefined) {
    throw new Error("Expected importSplitPngSourceAsset preconditions to reject missing manifest metadata.");
  }

  const baseRevision = session.authoringRevision;
  const provenanceId = createProvenanceId(operationId);
  const contentHash = request.payload.contentHash ?? `metadata:${sourceAssetId}`;
  const sourceAsset = createSourceAssetFromPayload({
    payload: request.payload,
    sourceAssetId,
    manifestPath,
    contentHash
  });
  const provenanceRecord: ProvenanceRecord = {
    provenanceId,
    assetId: sourceAssetId,
    assetKind: "source",
    filePath: manifestPath,
    contentHash,
    creator: provenanceMetadata.creator,
    ...(provenanceMetadata.sourceUrl === undefined ? {} : { sourceUrl: provenanceMetadata.sourceUrl }),
    license: provenanceMetadata.license,
    redistributionAllowed: provenanceMetadata.redistributionAllowed,
    aiUsed: provenanceMetadata.aiUsed,
    transformHistory: [
      "importSplitPngSourceAsset:manifest-metadata",
      ...provenanceMetadata.transformHistory
    ],
    relatedOperationIds: [operationId]
  };
  const rightsRecord: RightsRecord = {
    assetId: sourceAssetId,
    rightsStatus: rightsMetadata.rightsStatus,
    license: rightsMetadata.license,
    redistributionAllowed: rightsMetadata.redistributionAllowed
  };
  const mutation = importSourceAssetMetadata(session, {
    sourceAsset,
    provenanceRecord,
    rightsRecord
  });
  const textureMaterializations = materializeSplitPngLayerTexturePreviewMetadata({
    session,
    payload: request.payload,
    sourceAssetId,
    provenanceId
  });

  return {
    result: createImportSplitPngSourceAssetResult({
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
      diagnostics: createSplitPngBinaryAssetReferenceOperationDiagnostics({
        payload: request.payload,
        sourceAssetId
      })
    }),
    targetIds,
    candidateSession: session
  };
};

const evaluateImportSplitPngSourceAssetPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly request: Extract<OperationRequestDto, { operationType: "importSplitPngSourceAsset" }>;
  readonly operationId: OperationId;
  readonly sourceAssetId: SourceAssetId;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];
  const sourceTarget: TargetRefDto = { kind: "sourceAsset", id: input.sourceAssetId };
  const expectedProvenanceId = createProvenanceId(input.operationId);

  if (normalizeManifestPath(input.request.payload.manifestPath) === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.missingManifestPath",
        message: "Split PNG source import requires a manifest path.",
        target: { ...sourceTarget, path: "/payload/manifestPath" }
      })
    );
  }

  diagnostics.push(
    ...evaluateSourceBinaryAssetReferencePreconditions({
      operationCheckIdPrefix: "operation.importSplitPngSourceAsset",
      sourceTarget,
      expectedPackageRelativePath: normalizeManifestPath(input.request.payload.manifestPath),
      expectedProvenanceId,
      expectedRightsAssetId: input.sourceAssetId,
      binaryAssetRef: input.request.payload.binaryAssetRef,
      payloadPath: "/payload/binaryAssetRef"
    })
  );

  if (input.request.payload.importProfile !== "split-png-fallback-v1") {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.invalidImportProfile",
        message: `Unsupported split PNG import profile: ${input.request.payload.importProfile}.`,
        target: { ...sourceTarget, path: "/payload/importProfile" }
      })
    );
  }

  if (getSourceAssetById(input.session.graph, input.sourceAssetId) !== undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.duplicateSourceAsset",
        message: `Source asset already exists: ${input.sourceAssetId}.`,
        target: sourceTarget
      })
    );
  }

  if (input.request.payload.rights === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.missingRights",
        message: "Split PNG source import requires rights metadata.",
        target: { ...sourceTarget, path: "/payload/rights" }
      })
    );
  } else if (input.request.payload.rights.rightsStatus === "blocked") {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.blockedRights",
        message: `Blocked rights cannot be imported for source asset ${input.sourceAssetId}.`,
        target: { ...sourceTarget, path: "/payload/rights/rightsStatus" }
      })
    );
  }

  if (input.request.payload.provenance === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.missingProvenance",
        message: "Split PNG source import requires provenance metadata.",
        target: { ...sourceTarget, path: "/payload/provenance" }
      })
    );
  }

  if (input.request.payload.layers.length === 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.missingLayers",
        message: "Split PNG source import requires at least one layer metadata entry.",
        target: { ...sourceTarget, path: "/payload/layers" }
      })
    );
  }

  diagnostics.push(
    ...evaluateLayerMetadataPreconditions({
      session: input.session,
      payload: input.request.payload,
      sourceTarget,
      expectedProvenanceId,
      expectedRightsAssetId: input.sourceAssetId
    })
  );

  if (
    input.request.payload.defaultPartId !== undefined &&
    getPartById(input.session.graph, input.request.payload.defaultPartId) === undefined
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.importSplitPngSourceAsset.missingDefaultPart",
        message: `Default part does not exist: ${input.request.payload.defaultPartId}.`,
        target: { kind: "part", id: input.request.payload.defaultPartId }
      })
    );
  }

  return diagnostics;
};

const evaluateLayerMetadataPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly payload: SplitPngSourceAssetPayloadDto;
  readonly sourceTarget: TargetRefDto;
  readonly expectedProvenanceId: ProvenanceId;
  readonly expectedRightsAssetId: SourceAssetId;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];
  const seenLayerIds = new Set<string>();
  const seenTextureIds = new Set<string>();

  for (const layer of input.payload.layers) {
    if (seenLayerIds.has(layer.sourceLayerId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.importSplitPngSourceAsset.duplicateSourceLayer",
          message: `Source layer appears more than once: ${layer.sourceLayerId}.`,
          target: { ...input.sourceTarget, path: `/payload/layers/${layer.sourceLayerId}` }
        })
      );
    }

    seenLayerIds.add(layer.sourceLayerId);

    if (input.payload.placementPolicy === "use-metadata" && layer.bounds === undefined) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.importSplitPngSourceAsset.missingLayerBounds",
          message: `Layer ${layer.sourceLayerId} is missing bounds required by use-metadata placement.`,
          target: { ...input.sourceTarget, path: `/payload/layers/${layer.sourceLayerId}/bounds` }
        })
      );
    }

    diagnostics.push(
      ...evaluateSplitPngLayerTextureMappingPreconditions({
        session: input.session,
        payload: input.payload,
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

const createSourceAssetFromPayload = (input: {
  readonly payload: SplitPngSourceAssetPayloadDto;
  readonly sourceAssetId: SourceAssetId;
  readonly manifestPath: string;
  readonly contentHash: string;
}): SourceAsset => ({
  sourceAssetId: input.sourceAssetId,
  kind: "split-png-set-v1",
  filePath: input.manifestPath,
  contentHash: input.contentHash,
  importProfile: "split-png-fallback-v1",
  layers: input.payload.layers.map((layer) =>
    createSourceLayerFromPayload({
      layer,
      sourceAssetId: input.sourceAssetId,
      placementPolicy: input.payload.placementPolicy
    })
  ),
  diagnostics: createSplitPngSourceAssetDiagnostics(input.payload),
  ...(input.payload.binaryAssetRef === undefined
    ? {}
    : { binaryAssetRef: structuredClone(input.payload.binaryAssetRef) })
});

const createSourceLayerFromPayload = (input: {
  readonly layer: SplitPngSourceLayerMetadataDto;
  readonly sourceAssetId: SourceAssetId;
  readonly placementPolicy: SplitPngSourceAssetPayloadDto["placementPolicy"];
}): SourceLayer => ({
  sourceLayerId: input.layer.sourceLayerId,
  sourceAssetId: input.sourceAssetId,
  originalName: input.layer.originalName,
  normalizedName: input.layer.normalizedName ?? normalizeDisplayName(input.layer.originalName),
  groupPath: [...input.layer.groupPath],
  bounds:
    input.layer.bounds === undefined
      ? { x: 0, y: 0, width: 1, height: 1 }
      : structuredClone(input.layer.bounds),
  visibleInSource: input.layer.visibleInSource,
  opacityInSource: input.layer.opacityInSource,
  role: input.layer.role,
  unsupportedFeatures: [...input.layer.unsupportedFeatures],
  mappedDrawableIds: []
});

const createImportSplitPngSourceAssetResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly sourceTarget: TargetRefDto;
  readonly sourceAsset: SourceAsset;
  readonly provenanceRecord: ProvenanceRecord;
  readonly rightsRecord: RightsRecord;
  readonly textureMaterializations: readonly SplitPngTextureMaterializationResult[];
  readonly diagnostics: readonly DiagnosticDto[];
}): OperationResultDto => {
  const packageTarget: TargetRefDto = { kind: "package", id: input.packageId };
  const textureTargets = input.textureMaterializations.map((materialization) => ({
    kind: "texture" as const,
    id: materialization.textureEntry.textureId
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
    precondition: createPreconditionResult([], [input.sourceTarget, packageTarget, ...textureTargets]),
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

const normalizeManifestPath = (manifestPath: string | undefined): string | undefined => {
  const trimmed = manifestPath?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
};

const collectImportTargetIds = (
  payload: SplitPngSourceAssetPayloadDto,
  sourceAssetId: SourceAssetId
): readonly string[] =>
  uniqueStrings([
    sourceAssetId,
    ...payload.layers.map((layer) => layer.sourceLayerId),
    ...payload.layers.flatMap((layer) => {
      if (!splitPngLayerRequestsTextureMaterialization(layer)) {
        return [];
      }

      const effectivePartId = layer.targetPartId ?? payload.defaultPartId;
      return [
        ...(layer.textureId === undefined ? [] : [layer.textureId]),
        ...(effectivePartId === undefined ? [] : [effectivePartId])
      ];
    })
  ]);

const resolveSourceAssetId = (payload: SplitPngSourceAssetPayloadDto): SourceAssetId =>
  payload.sourceAssetId ?? createSourceAssetIdFromManifestPath(payload.manifestPath ?? "split_png_manifest");

const createSourceAssetIdFromManifestPath = (manifestPath: string): SourceAssetId =>
  SourceAssetIdSchema.parse(`src_${sanitizeIdToken(manifestPath.replace(/\.[^.\\/]+$/, ""))}`);

const normalizeDisplayName = (value: string): string => sanitizeIdToken(value).replace(/_/g, " ");

const uniqueStrings = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};

const sanitizeIdToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
};

const toJsonValue = (value: unknown): JsonValue =>
  JSON.parse(JSON.stringify(value)) as JsonValue;

type SourceAsset = AuthoringSession["graph"]["sourceAssets"][number];
type SourceLayer = SourceAsset["layers"][number];
type ProvenanceRecord = AuthoringSession["graph"]["provenanceRecords"][number];
type RightsRecord = AuthoringSession["graph"]["rightsRecords"][number];
