import type {
  CheckStatus,
  Severity
} from "@private-2d-rigging-lab/contracts";
import {
  DiagnosticSchema,
  DrawableIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  PartIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  BinaryAssetDigestDto,
  BinaryAssetReferenceDto,
  DrawableDto,
  MeshDto,
  PackageDocumentDto,
  PsdLayerMaterializationEvidenceDto,
  SourceAssetDto,
  TextureAtlasEntryDto
} from "@private-2d-rigging-lab/package-format";
import { PsdSourceLayerReferenceSchema } from "@private-2d-rigging-lab/package-format";
import { z } from "zod";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

const WAVE47_RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";
const PSD_BATCH_SELECTED_LAYER_LIMIT = 4;
const PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT = 32 * 1024 * 1024;

const PsdLayerMaterializationBatchGeneratedTargetsSchema = z.object({
  partId: PartIdSchema,
  partDisplayName: z.string().min(1),
  drawableId: DrawableIdSchema,
  drawableDisplayName: z.string().min(1),
  textureId: TextureIdSchema,
  meshId: MeshIdSchema
}).strict();
type PsdLayerMaterializationBatchGeneratedTargetsDto = z.infer<
  typeof PsdLayerMaterializationBatchGeneratedTargetsSchema
>;

const PsdLayerMaterializationBatchEntrySchema = z.object({
  selectedIndex: z.number().int().nonnegative(),
  sourceLayerRef: PsdSourceLayerReferenceSchema,
  materializationId: z.string().regex(/^mat_[A-Za-z0-9_-]+$/),
  materializedByteLength: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  status: z.enum(["success", "preflightReady", "preflightBlocked"]),
  generated: PsdLayerMaterializationBatchGeneratedTargetsSchema,
  operationId: OperationIdSchema.optional(),
  diagnostics: z.array(DiagnosticSchema).default([])
}).strict();
type PsdLayerMaterializationBatchEntryDto = z.infer<
  typeof PsdLayerMaterializationBatchEntrySchema
>;

const PsdLayerMaterializationBatchEvidenceSchema = z.object({
  schemaVersion: z.literal("psd-layer-materialization-batch-operation-evidence-v1"),
  operationType: z.literal("importPsdLayerMaterializationBatch"),
  batchId: z.string().regex(/^batch_[A-Za-z0-9_-]+$/),
  sourceAssetId: SourceAssetIdSchema,
  destination: z.object({
    destinationKind: z.literal("generatedPartScaffold"),
    parentPartId: PartIdSchema
  }).strict(),
  aggregateStatus: z.enum(["success", "preflightBlocked", "partialFailure", "failure"]),
  selectedLayerCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  totalMaterializedByteLength: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  entries: z.array(PsdLayerMaterializationBatchEntrySchema),
  perLayerOperationIds: z.array(OperationIdSchema).default([]),
  preflightPolicy: z.object({
    selectedLayerLimit: z.literal(PSD_BATCH_SELECTED_LAYER_LIMIT),
    totalRawRgbaByteLimit: z.literal(PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT),
    mutationPolicy: z.literal("preflightBlocksOnAnyFailure"),
    silentPartialSuccess: z.literal("forbidden")
  }).strict(),
  persistenceBoundary: z.object({
    rawParserObjectPersistence: z.literal("notPersisted"),
    sourcePsdBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    materializedLayerBytePersistence: z.literal("binaryAssetRefOnlyNoInlineBytes"),
    photoshopCompositingClaim: z.literal("none"),
    rendererPixelOracleClaim: z.literal("none")
  }).strict()
}).strict();
type PsdLayerMaterializationBatchEvidenceDto = z.infer<
  typeof PsdLayerMaterializationBatchEvidenceSchema
>;

export interface PsdMaterializedBatchDiagnosticsInput {
  readonly packageDocument: PackageDocumentDto;
  readonly batchEvidence?: readonly unknown[];
  readonly requireBatchEvidence?: boolean;
}

export const validatePsdMaterializedBatchDiagnostics = (
  input: PsdMaterializedBatchDiagnosticsInput
): readonly ValidationCheckResultDto[] => {
  const evidence = input.batchEvidence ?? [];
  if (evidence.length === 0) {
    return input.requireBatchEvidence === true
      ? [createBatchEvidenceMissingCheck(input.packageDocument)]
      : [];
  }

  const indexes = createBatchIndexes(input.packageDocument);
  return evidence.flatMap((candidate, batchIndex) => {
    const parsed = PsdLayerMaterializationBatchEvidenceSchema.safeParse(candidate);
    if (!parsed.success) {
      return [createBatchEvidenceMismatchCheck({
        packageDocument: input.packageDocument,
        batchIndex,
        issues: parsed.error.issues.map((issue) =>
          `${issue.path.join(".") || "<root>"}:${issue.message}`
        )
      })];
    }

    return validateBatchEvidence({
      packageDocument: input.packageDocument,
      indexes,
      batch: parsed.data,
      batchIndex
    });
  });
};

interface BatchIndexes {
  readonly sourceAssetsById: ReadonlyMap<string, SourceAssetWithIndex>;
  readonly materializationsByKey: ReadonlyMap<string, MaterializationWithIndex>;
  readonly partsById: ReadonlyMap<string, PartWithIndex>;
  readonly drawablesById: ReadonlyMap<string, DrawableWithIndex>;
  readonly meshesById: ReadonlyMap<string, MeshWithIndex>;
  readonly texturesById: ReadonlyMap<string, TextureWithIndex>;
}

interface SourceAssetWithIndex {
  readonly sourceAsset: SourceAssetDto;
  readonly index: number;
}

interface MaterializationWithIndex {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly materialization: PsdLayerMaterializationEvidenceDto;
  readonly materializationIndex: number;
  readonly targetPath: string;
}

interface PartWithIndex {
  readonly partId: string;
  readonly parentPartId?: string;
  readonly childPartIds: readonly string[];
  readonly drawableIds: readonly string[];
  readonly index: number;
}

interface DrawableWithIndex {
  readonly drawable: DrawableDto;
  readonly index: number;
}

interface MeshWithIndex {
  readonly mesh: MeshDto;
  readonly index: number;
}

interface TextureWithIndex {
  readonly texture: TextureAtlasEntryDto;
  readonly index: number;
}

interface BatchValidationContext {
  readonly packageDocument: PackageDocumentDto;
  readonly indexes: BatchIndexes;
  readonly batch: PsdLayerMaterializationBatchEvidenceDto;
  readonly batchIndex: number;
}

interface BatchEntryValidationContext extends BatchValidationContext {
  readonly entry: PsdLayerMaterializationBatchEntryDto;
  readonly entryIndex: number;
}

const createBatchIndexes = (packageDocument: PackageDocumentDto): BatchIndexes => {
  const sourceAssetsById = new Map<string, SourceAssetWithIndex>();
  const materializationsByKey = new Map<string, MaterializationWithIndex>();

  packageDocument.assets.sourceManifest.sourceAssets.forEach((sourceAsset, sourceAssetIndex) => {
    sourceAssetsById.set(sourceAsset.sourceAssetId, { sourceAsset, index: sourceAssetIndex });
    (sourceAsset.psdProfile?.materializationEvidence ?? []).forEach((materialization, materializationIndex) => {
      materializationsByKey.set(
        createMaterializationKey(sourceAsset.sourceAssetId, materialization.materializationId),
        {
          sourceAsset,
          sourceAssetIndex,
          materialization,
          materializationIndex,
          targetPath:
            `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
            `/psdProfile/materializationEvidence/${materializationIndex}`
        }
      );
    });
  });

  return {
    sourceAssetsById,
    materializationsByKey,
    partsById: new Map<string, PartWithIndex>(
      packageDocument.model.graph.parts.map((part, index) => [
        part.partId,
        {
          partId: part.partId,
          ...(part.parentPartId === undefined ? {} : { parentPartId: part.parentPartId }),
          childPartIds: part.childPartIds,
          drawableIds: part.drawableIds,
          index
        }
      ])
    ),
    drawablesById: new Map<string, DrawableWithIndex>(
      packageDocument.model.drawables.drawables.map((drawable, index) => [
        drawable.drawableId,
        { drawable, index }
      ])
    ),
    meshesById: new Map<string, MeshWithIndex>(
      packageDocument.model.meshes.meshes.map((mesh, index) => [
        mesh.meshId,
        { mesh, index }
      ])
    ),
    texturesById: new Map<string, TextureWithIndex>(
      packageDocument.assets.textureAtlas?.textures.map((texture, index) => [
        texture.textureId,
        { texture, index }
      ]) ?? []
    )
  };
};

const validateBatchEvidence = (
  context: BatchValidationContext
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [
    ...validateBatchAggregateStatus(context),
    ...validateBatchDestinationParent(context),
    ...validateBatchDuplicateLayerRefs(context),
    ...validateBatchOperationDiagnostics(context)
  ];

  context.batch.entries.forEach((entry, entryIndex) => {
    checks.push(...validateBatchEntry({
      ...context,
      entry,
      entryIndex
    }));
  });

  const hasBlockingOrNotEvaluatedIssue = checks.some((check) =>
    check.status === "fail" || check.status === "needs_review"
  );
  if (!hasBlockingOrNotEvaluatedIssue && context.batch.aggregateStatus === "success") {
    checks.push(createBatchAvailableCheck(context));
  }

  return checks;
};

const validateBatchAggregateStatus = (
  context: BatchValidationContext
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const actualSuccessCount = context.batch.entries.filter((entry) => entry.status === "success").length;
  const actualPreflightBlockedCount = context.batch.entries.filter((entry) =>
    entry.status === "preflightBlocked"
  ).length;
  const actualNotSuccessCount = context.batch.entries.length - actualSuccessCount;
  const countMismatchReasons = [
    ...(context.batch.selectedLayerCount === context.batch.entries.length
      ? []
      : ["selected-layer-count-mismatch"]),
    ...(context.batch.successCount === actualSuccessCount
      ? []
      : ["success-count-entry-status-mismatch"]),
    ...(context.batch.failureCount === actualPreflightBlockedCount
      ? []
      : ["failure-count-entry-status-mismatch"]),
    ...(context.batch.aggregateStatus === "success" && actualNotSuccessCount > 0
      ? ["success-aggregate-has-non-success-entry"]
      : []),
    ...(context.batch.aggregateStatus === "success" && context.batch.successCount !== context.batch.entries.length
      ? ["success-aggregate-success-count-mismatch"]
      : []),
    ...(context.batch.aggregateStatus === "success" && context.batch.failureCount !== 0
      ? ["success-aggregate-failure-count-nonzero"]
      : []),
    ...(context.batch.successCount <= context.batch.selectedLayerCount
      ? []
      : ["success-count-exceeds-selected-count"]),
    ...(context.batch.failureCount <= context.batch.selectedLayerCount
      ? []
      : ["failure-count-exceeds-selected-count"]),
    ...(context.batch.selectedLayerCount > PSD_BATCH_SELECTED_LAYER_LIMIT
      ? ["selected-layer-count-cap-exceeded"]
      : []),
    ...(context.batch.totalMaterializedByteLength > PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT
      ? ["total-raw-rgba-byte-cap-exceeded"]
      : [])
  ];

  if (countMismatchReasons.length > 0) {
    checks.push(createBatchIssueCheck({
      context,
      checkId: "asset.psd.materializedBatchEvidenceMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: createBatchTargetPath(context),
      message: `PSD materialization batch ${context.batch.batchId} has inconsistent count or cap evidence.`,
      evidence: [
        `selectedLayerCount=${context.batch.selectedLayerCount}`,
        `entryCount=${context.batch.entries.length}`,
        `successCount=${context.batch.successCount}`,
        `failureCount=${context.batch.failureCount}`,
        `actualSuccessEntryCount=${actualSuccessCount}`,
        `actualPreflightBlockedEntryCount=${actualPreflightBlockedCount}`,
        `actualNonSuccessEntryCount=${actualNotSuccessCount}`,
        `totalMaterializedByteLength=${context.batch.totalMaterializedByteLength}`,
        `selectedLayerLimit=${PSD_BATCH_SELECTED_LAYER_LIMIT}`,
        `totalRawRgbaByteLimit=${PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT}`,
        `reasons=${countMismatchReasons.join(",")}`
      ],
      impact:
        "Product Preflight cannot trust batch availability while the batch summary contradicts its per-layer evidence or v0 caps."
    }));
  }

  if (context.batch.aggregateStatus === "partialFailure") {
    checks.push(createBatchIssueCheck({
      context,
      checkId: "asset.psd.materializedBatchPartialFailure",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: createBatchTargetPath(context),
      message:
        `PSD materialization batch ${context.batch.batchId} reports partial failure and cannot be summarized as available.`,
      evidence: createBatchSummaryEvidence(context, [
        "partialBatchState=true",
        "silentPartialSuccess=forbidden"
      ]),
      impact:
        "Product Preflight must block a batch that mixed committed or materialized entries with failed entries."
    }));
  }

  if (
    context.batch.aggregateStatus === "preflightBlocked" ||
    context.batch.aggregateStatus === "failure"
  ) {
    checks.push(createBatchIssueCheck({
      context,
      checkId: "asset.psd.materializedBatchPreflightBlocked",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: createBatchTargetPath(context),
      message:
        `PSD materialization batch ${context.batch.batchId} was not committed because preflight or materialization failed.`,
      evidence: createBatchSummaryEvidence(context, [
        `aggregateStatus=${context.batch.aggregateStatus}`,
        "batchAvailability=blocking",
        "silentPartialSuccess=forbidden"
      ]),
      impact:
        "Product Preflight must not treat blocked batch evidence as available materialized layer bytes."
    }));
  }

  return checks;
};

const validateBatchDestinationParent = (
  context: BatchValidationContext
): readonly ValidationCheckResultDto[] => {
  if (context.indexes.partsById.has(context.batch.destination.parentPartId)) {
    return [];
  }

  return [
    createBatchIssueCheck({
      context,
      checkId: "asset.psd.materializedBatchDestinationParentInvalid",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `${createBatchTargetPath(context)}/destination/parentPartId`,
      message:
        `PSD materialization batch ${context.batch.batchId} references missing destination parent part ` +
        `${context.batch.destination.parentPartId}.`,
      evidence: createBatchSummaryEvidence(context, [
        `parentPartId=${context.batch.destination.parentPartId}`,
        "reason=missing-destination-parent-part"
      ]),
      impact:
        "Generated part scaffold evidence cannot be trusted without a valid selected parent part."
    })
  ];
};

const validateBatchDuplicateLayerRefs = (
  context: BatchValidationContext
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const firstByLayerRef = new Map<string, number>();

  context.batch.entries.forEach((entry, entryIndex) => {
    const key = createSourceLayerKey(entry.sourceLayerRef);
    const firstIndex = firstByLayerRef.get(key);
    if (firstIndex === undefined) {
      firstByLayerRef.set(key, entryIndex);
      return;
    }

    checks.push(createBatchEntryIssueCheck({
      context,
      entry,
      entryIndex,
      checkId: "asset.psd.materializedBatchDuplicateLayer",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: createEntryTargetPath(context, entryIndex, "sourceLayerRef"),
      message:
        `PSD materialization batch ${context.batch.batchId} repeats source layer ` +
        `${entry.sourceLayerRef.sourceLayerId}.`,
      evidence: [
        `duplicateLayerRef=${key}`,
        `firstEntryIndex=${firstIndex}`,
        "reason=duplicate-layer-ref"
      ],
      impact:
        "Explicit batch intake must not silently materialize the same PSD layer more than once."
    }));
  });

  return checks;
};

const validateBatchOperationDiagnostics = (
  context: BatchValidationContext
): readonly ValidationCheckResultDto[] =>
  context.batch.entries.flatMap((entry, entryIndex) =>
    entry.diagnostics.flatMap((diagnostic) => {
      if (diagnostic.checkId.endsWith(".duplicateLayerRef")) {
        return [
          createBatchEntryIssueCheck({
            context,
            entry,
            entryIndex,
            checkId: "asset.psd.materializedBatchDuplicateLayer",
            status: "fail",
            severity: "error",
            phase: "source_import",
            targetPath: createEntryTargetPath(context, entryIndex),
            message: diagnostic.message,
            evidence: [
              `operationDiagnostic=${diagnostic.checkId}`,
              ...diagnostic.evidence,
              "reason=duplicate-layer-ref"
            ],
            impact:
              "Explicit batch intake must surface duplicate selected PSD layers before Product Preflight can claim availability."
          })
        ];
      }

      if (
        diagnostic.checkId.endsWith(".duplicateGeneratedId") ||
        diagnostic.checkId.endsWith(".idNameCollision")
      ) {
        return [
          createBatchEntryIssueCheck({
            context,
            entry,
            entryIndex,
            checkId: "asset.psd.materializedBatchGeneratedScaffoldCollision",
            status: "fail",
            severity: "error",
            phase: "reference",
            targetPath: createEntryTargetPath(context, entryIndex, "generated"),
            message: diagnostic.message,
            evidence: [
              `operationDiagnostic=${diagnostic.checkId}`,
              ...diagnostic.evidence,
              "reason=generated-scaffold-collision"
            ],
            impact:
              "Generated part/drawable/mesh/texture IDs must be collision-free before batch intake can mutate the package."
          })
        ];
      }

      return [];
    })
  );

const validateBatchEntry = (
  context: BatchEntryValidationContext
): readonly ValidationCheckResultDto[] => {
  if (context.entry.status !== "success") {
    return [];
  }

  const materialization = context.indexes.materializationsByKey.get(
    createMaterializationKey(
      context.entry.sourceLayerRef.sourceAssetId,
      context.entry.materializationId
    )
  );
  if (materialization === undefined) {
    return [
      createBatchEntryIssueCheck({
        context,
        entry: context.entry,
        entryIndex: context.entryIndex,
        checkId: "asset.psd.materializedBatchEntryMissing",
        status: "fail",
        severity: "error",
        phase: "source_import",
        targetPath: createEntryTargetPath(context, context.entryIndex),
        message:
          `PSD materialization batch ${context.batch.batchId} marks entry ${context.entryIndex} ` +
          "successful, but the package has no matching per-layer materialization evidence.",
        evidence: [
          `expectedSourceAssetId=${context.entry.sourceLayerRef.sourceAssetId}`,
          `expectedMaterializationId=${context.entry.materializationId}`,
          `expectedSourceLayerId=${context.entry.sourceLayerRef.sourceLayerId}`,
          "reason=successful-entry-materialization-evidence-missing"
        ],
        impact:
          "Product Preflight cannot claim batch availability without per-layer materialized asset evidence."
      })
    ];
  }

  return [
    ...validateBatchEntryBytes({
      ...context,
      materialization
    }),
    ...validateBatchEntrySource({
      ...context,
      materialization
    }),
    ...validateBatchEntryProvenance({
      ...context,
      materialization
    }),
    ...validateBatchEntryGeneratedScaffold({
      ...context,
      materialization
    })
  ];
};

interface BatchEntryMaterializationContext extends BatchEntryValidationContext {
  readonly materialization: MaterializationWithIndex;
}

const validateBatchEntryBytes = (
  context: BatchEntryMaterializationContext
): readonly ValidationCheckResultDto[] => {
  const materialization = context.materialization.materialization;
  const binaryAssetRef = materialization.binaryAssetRef;
  if (binaryAssetRef === undefined || binaryAssetRef.storageStatus !== "stored-package-local-v1") {
    return [
      createBatchEntryIssueCheck({
        context,
        entry: context.entry,
        entryIndex: context.entryIndex,
        checkId: "asset.psd.materializedBatchBytesMissing",
        status: "fail",
        severity: "error",
        phase: "reference",
        targetPath: `${context.materialization.targetPath}/binaryAssetRef`,
        message:
          `PSD materialization batch ${context.batch.batchId} entry ${context.entryIndex} ` +
          "has missing or non-package-local materialized bytes.",
        evidence: [
          ...createMaterializationEvidence(context.materialization),
          `binaryAssetId=${binaryAssetRef?.binaryAssetId ?? "missing"}`,
          `storageStatus=${binaryAssetRef?.storageStatus ?? "missing"}`,
          "materializedBytesAvailability=missing",
          "requiredRecovery=re-materialize-or-reupload-or-reselect"
        ],
        impact:
          "Product Preflight cannot treat a batch layer as available without package-local materialized bytes."
      })
    ];
  }

  const mismatchReasons = createMaterializedAssetMismatchReasons(
    context.entry,
    materialization,
    binaryAssetRef
  );
  if (mismatchReasons.length === 0) {
    return [];
  }

  return [
    createBatchEntryIssueCheck({
      context,
      entry: context.entry,
      entryIndex: context.entryIndex,
      checkId: "asset.psd.materializedBatchAssetMismatch",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `${context.materialization.targetPath}/binaryAssetRef`,
      message:
        `PSD materialization batch ${context.batch.batchId} entry ${context.entryIndex} ` +
        "has stale or mismatched byte metadata.",
      evidence: [
        ...createMaterializationEvidence(context.materialization),
        ...createBinaryAssetRefEvidence(binaryAssetRef),
        `entryMaterializedByteLength=${context.entry.materializedByteLength}`,
        `materializationMediaType=${materialization.mediaType}`,
        `materializationDigest=${formatDigest(materialization.digest)}`,
        `materializationByteLength=${materialization.byteLength}`,
        `reasons=${mismatchReasons.join(",")}`
      ],
      impact:
        "Product Preflight cannot trust batch materialized bytes when media type, digest, byteLength, or raw RGBA dimensions disagree."
    })
  ];
};

const validateBatchEntrySource = (
  context: BatchEntryMaterializationContext
): readonly ValidationCheckResultDto[] => {
  const sourceAsset = context.materialization.sourceAsset;
  const materialization = context.materialization.materialization;
  const provenance = materialization.provenance;
  const expectedSourceDigest =
    sourceAsset.binaryAssetRef?.digest ??
    parseSourceAssetSha256ContentHash(sourceAsset.contentHash);
  const staleReasons = [
    ...(provenance.sourceDigest === undefined ? ["source-psd-digest-missing"] : []),
    ...(provenance.sourceByteLength === undefined ? ["source-psd-byte-length-missing"] : []),
    ...(provenance.sourceDigest !== undefined &&
    expectedSourceDigest !== undefined &&
    !sameDigest(provenance.sourceDigest, expectedSourceDigest)
      ? ["source-psd-digest-mismatch"]
      : []),
    ...(provenance.sourceByteLength !== undefined &&
    sourceAsset.binaryAssetRef !== undefined &&
    provenance.sourceByteLength !== sourceAsset.binaryAssetRef.byteLength
      ? ["source-psd-byte-length-mismatch"]
      : []),
    ...(context.entry.sourceLayerRef.sourceLayerId === materialization.sourceLayerRef.sourceLayerId
      ? []
      : ["source-layer-id-mismatch"])
  ];
  const checks: ValidationCheckResultDto[] = [];

  if (staleReasons.length > 0) {
    checks.push(createBatchEntryIssueCheck({
      context,
      entry: context.entry,
      entryIndex: context.entryIndex,
      checkId: "asset.psd.materializedBatchSourceStale",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${context.materialization.targetPath}/provenance`,
      message:
        `PSD materialization batch ${context.batch.batchId} entry ${context.entryIndex} ` +
        "was produced from stale or incomplete source PSD identity.",
      evidence: [
        ...createMaterializationEvidence(context.materialization),
        `materializationSourceDigest=${formatDigest(provenance.sourceDigest)}`,
        `expectedSourceDigest=${formatDigest(expectedSourceDigest)}`,
        `materializationSourceByteLength=${provenance.sourceByteLength ?? "missing"}`,
        `expectedSourceByteLength=${sourceAsset.binaryAssetRef?.byteLength ?? "unavailable"}`,
        `entrySourceLayerId=${context.entry.sourceLayerRef.sourceLayerId}`,
        `materializationSourceLayerId=${materialization.sourceLayerRef.sourceLayerId}`,
        `reasons=${staleReasons.join(",")}`
      ],
      impact:
        "Batch materialized layer bytes must be traceable to the current source PSD identity and selected layer."
    }));
  }

  if (
    sourceAsset.binaryAssetRef === undefined ||
    sourceAsset.binaryAssetRef.storageStatus !== "stored-package-local-v1"
  ) {
    checks.push(createBatchEntryIssueCheck({
      context,
      entry: context.entry,
      entryIndex: context.entryIndex,
      checkId: "asset.psd.materializedBatchSourceCurrentBytesMissing",
      status: "warning",
      severity: "warning",
      phase: "source_import",
      targetPath: `/assets/sourceManifest/sourceAssets/${context.materialization.sourceAssetIndex}/binaryAssetRef`,
      message:
        `PSD materialization batch ${context.batch.batchId} source ${sourceAsset.sourceAssetId} ` +
        "has no current package-local source PSD bytes for re-materialization.",
      evidence: [
        ...createMaterializationEvidence(context.materialization),
        `sourceBinaryAssetRef=${sourceAsset.binaryAssetRef?.binaryAssetId ?? "missing"}`,
        `sourceBinaryStorageStatus=${sourceAsset.binaryAssetRef?.storageStatus ?? "missing"}`,
        "sourcePsdBytePersistence=metadataOnlyNoRawBytes",
        "reMaterializationRequiresReupload=true"
      ],
      impact:
        "Existing materialized batch bytes may still be usable, but re-materialization requires reupload or reselection."
    }));
  }

  return checks;
};

const validateBatchEntryProvenance = (
  context: BatchEntryMaterializationContext
): readonly ValidationCheckResultDto[] => {
  const provenance = context.materialization.materialization.provenance;
  const reasons = [
    ...(["packageLocalAsset", "privateLocalFixture"].includes(provenance.privacyLabel)
      ? []
      : ["private-local-privacy-label-missing"]),
    ...(provenance.publicDistribution === "notPublicDistributable"
      ? []
      : ["public-distribution-policy-mismatch"]),
    ...(provenance.publicDemoAsset === false
      ? []
      : [provenance.publicDemoAsset === undefined
          ? "public-demo-asset-flag-missing"
          : "public-demo-asset-true"])
  ];

  if (reasons.length === 0) {
    return [];
  }

  return [
    createBatchEntryIssueCheck({
      context,
      entry: context.entry,
      entryIndex: context.entryIndex,
      checkId: "asset.psd.materializedBatchProvenanceBlocked",
      status: "fail",
      severity: reasons.includes("public-demo-asset-true") ? "blocking" : "error",
      phase: "rights",
      targetPath: `${context.materialization.targetPath}/provenance`,
      message:
        `PSD materialization batch ${context.batch.batchId} entry ${context.entryIndex} ` +
        "lacks private/local provenance required for selected-layer asset intake.",
      evidence: [
        ...createMaterializationEvidence(context.materialization),
        `privacyLabel=${provenance.privacyLabel}`,
        `publicDistribution=${provenance.publicDistribution}`,
        `publicDemoAsset=${provenance.publicDemoAsset ?? "missing"}`,
        `reasons=${reasons.join(",")}`
      ],
      impact:
        "Product Preflight must not treat batch PSD layer bytes as usable without explicit non-public provenance."
    })
  ];
};

const validateBatchEntryGeneratedScaffold = (
  context: BatchEntryMaterializationContext
): readonly ValidationCheckResultDto[] => {
  const generated = context.entry.generated;
  const part = context.indexes.partsById.get(generated.partId);
  const parentPart = context.indexes.partsById.get(context.batch.destination.parentPartId);
  const drawable = context.indexes.drawablesById.get(generated.drawableId);
  const mesh = context.indexes.meshesById.get(generated.meshId);
  const texture = context.indexes.texturesById.get(generated.textureId);
  const materialization = context.materialization.materialization;
  const mismatchReasons = [
    ...(part === undefined ? ["generated-part-missing"] : []),
    ...(parentPart === undefined ? ["destination-parent-part-missing"] : []),
    ...(part !== undefined &&
    parentPart !== undefined &&
    part.parentPartId !== context.batch.destination.parentPartId &&
    !parentPart.childPartIds.includes(generated.partId)
      ? ["generated-part-parent-mismatch"]
      : []),
    ...(part !== undefined && !part.drawableIds.includes(generated.drawableId)
      ? ["generated-part-drawable-membership-missing"]
      : []),
    ...(drawable === undefined ? ["generated-drawable-missing"] : []),
    ...(drawable !== undefined && drawable.drawable.partId !== generated.partId
      ? ["generated-drawable-part-mismatch"]
      : []),
    ...(drawable !== undefined && drawable.drawable.textureId !== generated.textureId
      ? ["generated-drawable-texture-mismatch"]
      : []),
    ...(drawable !== undefined && drawable.drawable.meshId !== generated.meshId
      ? ["generated-drawable-mesh-mismatch"]
      : []),
    ...(mesh === undefined ? ["generated-mesh-missing"] : []),
    ...(mesh !== undefined && mesh.mesh.drawableId !== generated.drawableId
      ? ["generated-mesh-drawable-mismatch"]
      : []),
    ...(texture === undefined ? ["generated-texture-missing"] : []),
    ...(texture !== undefined && texture.texture.sourceAssetId !== context.batch.sourceAssetId
      ? ["generated-texture-source-asset-mismatch"]
      : []),
    ...(texture !== undefined && texture.texture.sourceLayerId !== context.entry.sourceLayerRef.sourceLayerId
      ? ["generated-texture-source-layer-mismatch"]
      : []),
    ...(materialization.textureId === generated.textureId
      ? []
      : ["materialization-texture-id-mismatch"]),
    ...createTextureMaterializedBinaryMismatchReasons(texture?.texture, materialization)
  ];

  if (mismatchReasons.length === 0) {
    return [];
  }

  return [
    createBatchEntryIssueCheck({
      context,
      entry: context.entry,
      entryIndex: context.entryIndex,
      checkId: "asset.psd.materializedBatchGeneratedScaffoldMismatch",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: createEntryTargetPath(context, context.entryIndex, "generated"),
      message:
        `PSD materialization batch ${context.batch.batchId} generated scaffold for entry ` +
        `${context.entryIndex} is missing or inconsistent.`,
      evidence: [
        ...createMaterializationEvidence(context.materialization),
        ...createGeneratedTargetEvidence(generated),
        `destinationParentPartId=${context.batch.destination.parentPartId}`,
        `partMatch=${part === undefined ? "missing" : "present"}`,
        `parentPartMatch=${parentPart === undefined ? "missing" : "present"}`,
        `drawableMatch=${drawable === undefined ? "missing" : "present"}`,
        `meshMatch=${mesh === undefined ? "missing" : "present"}`,
        `textureMatch=${texture === undefined ? "missing" : "present"}`,
        `textureBinaryAssetId=${texture?.texture.binaryAssetRef?.binaryAssetId ?? "missing"}`,
        `reasons=${mismatchReasons.join(",")}`
      ],
      impact:
        "Product Preflight cannot claim generated part scaffold availability until parent part, generated part, drawable, mesh, texture, and materialized binary references agree."
    })
  ];
};

const createMaterializedAssetMismatchReasons = (
  entry: PsdLayerMaterializationBatchEntryDto,
  materialization: PsdLayerMaterializationEvidenceDto,
  binaryAssetRef: BinaryAssetReferenceDto
): readonly string[] => [
  ...(binaryAssetRef.packageRelativePath.startsWith("assets/textures/")
    ? []
    : ["package-relative-path-not-texture-local"]),
  ...(materialization.mediaType === WAVE47_RAW_RGBA_MEDIA_TYPE
    ? []
    : ["materialized-media-type-not-wave47-raw-rgba"]),
  ...(binaryAssetRef.mediaType === WAVE47_RAW_RGBA_MEDIA_TYPE
    ? []
    : ["binary-media-type-not-wave47-raw-rgba"]),
  ...(sameDigest(binaryAssetRef.digest, materialization.digest)
    ? []
    : ["materialized-digest-mismatch"]),
  ...(binaryAssetRef.byteLength === materialization.byteLength
    ? []
    : ["materialized-byte-length-mismatch"]),
  ...(entry.materializedByteLength === materialization.byteLength
    ? []
    : ["batch-entry-byte-length-mismatch"]),
  ...(binaryAssetRef.mediaType === materialization.mediaType
    ? []
    : ["materialized-media-type-mismatch"]),
  ...(materialization.width !== undefined &&
  materialization.height !== undefined &&
  materialization.byteLength !== materialization.width * materialization.height * 4
    ? ["raw-rgba-byte-length-mismatch"]
    : [])
];

const createTextureMaterializedBinaryMismatchReasons = (
  textureEntry: TextureAtlasEntryDto | undefined,
  materialization: PsdLayerMaterializationEvidenceDto
): readonly string[] => {
  if (textureEntry === undefined || materialization.binaryAssetRef === undefined) {
    return [];
  }

  const textureBinaryAssetRef = textureEntry.binaryAssetRef;
  const materializedBinaryAssetRef = materialization.binaryAssetRef;
  const expectedContentHash = formatDigest(materialization.digest);

  return [
    ...(textureEntry.filePath === materializedBinaryAssetRef.packageRelativePath
      ? []
      : ["texture-file-path-mismatch"]),
    ...(textureEntry.contentHash === undefined || textureEntry.contentHash === expectedContentHash
      ? []
      : ["texture-content-hash-mismatch"]),
    ...(textureEntry.provenanceId === materializedBinaryAssetRef.provenanceId
      ? []
      : ["texture-provenance-id-mismatch"]),
    ...(textureBinaryAssetRef === undefined
      ? ["texture-binary-asset-ref-missing"]
      : [
          ...(textureBinaryAssetRef.binaryAssetId === materializedBinaryAssetRef.binaryAssetId
            ? []
            : ["texture-binary-asset-id-mismatch"]),
          ...(textureBinaryAssetRef.packageRelativePath === materializedBinaryAssetRef.packageRelativePath
            ? []
            : ["texture-binary-path-mismatch"]),
          ...(sameDigest(textureBinaryAssetRef.digest, materializedBinaryAssetRef.digest)
            ? []
            : ["texture-binary-digest-mismatch"]),
          ...(textureBinaryAssetRef.byteLength === materializedBinaryAssetRef.byteLength
            ? []
            : ["texture-binary-byte-length-mismatch"]),
          ...(textureBinaryAssetRef.mediaType === materializedBinaryAssetRef.mediaType
            ? []
            : ["texture-binary-media-type-mismatch"]),
          ...(textureBinaryAssetRef.storageStatus === materializedBinaryAssetRef.storageStatus
            ? []
            : ["texture-binary-storage-status-mismatch"]),
          ...(textureBinaryAssetRef.provenanceId === materializedBinaryAssetRef.provenanceId
            ? []
            : ["texture-binary-provenance-id-mismatch"]),
          ...(textureBinaryAssetRef.rightsAssetId === materializedBinaryAssetRef.rightsAssetId
            ? []
            : ["texture-binary-rights-asset-id-mismatch"])
        ])
  ];
};

const createBatchEvidenceMissingCheck = (
  packageDocument: PackageDocumentDto
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "asset.psd.materializedBatchEvidenceMissing",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    target: {
      kind: "package",
      id: packageDocument.manifest.packageId
    },
    targetPath: "/session/psdLayerMaterializationBatchEvidence",
    message:
      "No session PSD layer materialization batch evidence was supplied for Product Preflight.",
    evidence: [
      "batchEvidenceAvailability=not_evaluated",
      "requiredEvidence=psdLayerMaterializationBatchEvidence",
      "validatorBoundary=no-parser-execution",
      "rawParserObject=notPersisted",
      "rawMaterializedBytes=notInlined",
      "productPreflightPersistence=sessionOnly"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003"],
    impact:
      "Product Preflight must report batch materialization as not evaluated until session batch evidence is supplied."
  });

const createBatchEvidenceMismatchCheck = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly batchIndex: number;
  readonly issues: readonly string[];
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "asset.psd.materializedBatchEvidenceMismatch",
    status: "fail",
    severity: "error",
    phase: "source_import",
    target: {
      kind: "package",
      id: input.packageDocument.manifest.packageId,
      path: `/session/psdLayerMaterializationBatchEvidence/${input.batchIndex}`
    },
    targetPath: `/session/psdLayerMaterializationBatchEvidence/${input.batchIndex}`,
    message:
      `PSD layer materialization batch evidence ${input.batchIndex} does not match the Wave47 parser-free evidence schema.`,
    evidence: [
      `batchIndex=${input.batchIndex}`,
      `schemaIssues=${input.issues.join("|")}`,
      "validatorBoundary=no-parser-execution",
      "rawParserObject=notPersisted",
      "rawMaterializedBytes=notInlined",
      "productPreflightPersistence=sessionOnly"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003"],
    impact:
      "Product Preflight cannot trust malformed batch evidence or infer missing parser/runtime details."
  });

const createBatchAvailableCheck = (
  context: BatchValidationContext
): ValidationCheckResultDto =>
  createBatchIssueCheck({
    context,
    checkId: "asset.psd.materializedBatchAvailable",
    status: "pass",
    severity: "info",
    phase: "source_import",
    targetPath: createBatchTargetPath(context),
    message:
      `PSD materialization batch ${context.batch.batchId} has parser-free materialized asset and generated part scaffold evidence for all selected entries.`,
    evidence: createBatchSummaryEvidence(context, [
      "batchMaterializedAssetAvailability=available",
      "generatedPartScaffoldAvailability=available",
      "materializedBytesAvailability=package-local-binary-ref",
      "batchMutationPolicy=preflightBlocksOnAnyFailure",
      "productPreflightPersistence=sessionOnly"
    ]),
    impact:
      "Product Preflight can treat this explicit selected-layer batch as available metadata and package-local byte evidence without parser execution, renderer proof, or pixel oracle claims."
  });

const createBatchIssueCheck = (input: {
  readonly context: BatchValidationContext;
  readonly checkId: string;
  readonly status: CheckStatus;
  readonly severity: Severity;
  readonly phase: "source_import" | "rights" | "reference";
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: input.status,
    severity: input.severity,
    phase: input.phase,
    target: {
      kind: "sourceAsset",
      id: input.context.batch.sourceAssetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: [
      ...createCommonBatchEvidence(input.context),
      ...input.evidence,
      ...createBoundaryEvidence()
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003"],
    impact: input.impact
  });

const createBatchEntryIssueCheck = (input: {
  readonly context: BatchValidationContext;
  readonly entry: PsdLayerMaterializationBatchEntryDto;
  readonly entryIndex: number;
  readonly checkId: string;
  readonly status: CheckStatus;
  readonly severity: Severity;
  readonly phase: "source_import" | "rights" | "reference";
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: input.status,
    severity: input.severity,
    phase: input.phase,
    target: {
      kind: "sourceAsset",
      id: input.entry.sourceLayerRef.sourceAssetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: [
      ...createCommonBatchEvidence(input.context),
      ...createCommonEntryEvidence(input.entry, input.entryIndex),
      ...input.evidence,
      ...createBoundaryEvidence()
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003"],
    impact: input.impact
  });

const createCommonBatchEvidence = (
  context: BatchValidationContext
): readonly string[] => [
  `batchId=${context.batch.batchId}`,
  `batchIndex=${context.batchIndex}`,
  `batchSourceAssetId=${context.batch.sourceAssetId}`,
  `destinationKind=${context.batch.destination.destinationKind}`,
  `destinationParentPartId=${context.batch.destination.parentPartId}`,
  `aggregateStatus=${context.batch.aggregateStatus}`,
  `selectedLayerCount=${context.batch.selectedLayerCount}`,
  `successCount=${context.batch.successCount}`,
  `failureCount=${context.batch.failureCount}`,
  `totalMaterializedByteLength=${context.batch.totalMaterializedByteLength}`
];

const createCommonEntryEvidence = (
  entry: PsdLayerMaterializationBatchEntryDto,
  entryIndex: number
): readonly string[] => [
  `entryIndex=${entryIndex}`,
  `selectedIndex=${entry.selectedIndex}`,
  `entryStatus=${entry.status}`,
  `entrySourceAssetId=${entry.sourceLayerRef.sourceAssetId}`,
  `entrySourceLayerId=${entry.sourceLayerRef.sourceLayerId}`,
  `entrySourceLayerName=${entry.sourceLayerRef.sourceLayerName ?? "missing"}`,
  `entrySourceLayerPath=${entry.sourceLayerRef.sourceLayerPath?.join("/") ?? "missing"}`,
  `entryMaterializationId=${entry.materializationId}`,
  `entryMaterializedByteLength=${entry.materializedByteLength}`,
  `entryOperationId=${entry.operationId ?? "missing"}`,
  ...createGeneratedTargetEvidence(entry.generated)
];

const createBoundaryEvidence = (): readonly string[] => [
  "validatorBoundary=no-parser-execution",
  "rawParserObject=notPersisted",
  "sourcePsdBytes=notPersisted",
  "rawMaterializedBytes=notInlined",
  "photoshopCompositing=notClaimed",
  "rendererPixelOracle=notClaimed",
  "allLayerImport=notClaimed",
  "recursiveGroupImport=notClaimed",
  "publicDemoAsset=falseRequired"
];

const createBatchSummaryEvidence = (
  context: BatchValidationContext,
  extraEvidence: readonly string[]
): readonly string[] => [
  `entryStatuses=${context.batch.entries.map((entry) => `${entry.selectedIndex}:${entry.status}`).join(",")}`,
  `perLayerOperationIds=${context.batch.perLayerOperationIds.join(",") || "none"}`,
  ...extraEvidence
];

const createGeneratedTargetEvidence = (
  generated: PsdLayerMaterializationBatchGeneratedTargetsDto
): readonly string[] => [
  `generatedPartId=${generated.partId}`,
  `generatedDrawableId=${generated.drawableId}`,
  `generatedMeshId=${generated.meshId}`,
  `generatedTextureId=${generated.textureId}`,
  `generatedPartDisplayName=${generated.partDisplayName}`,
  `generatedDrawableDisplayName=${generated.drawableDisplayName}`
];

const createMaterializationEvidence = (
  materialization: MaterializationWithIndex
): readonly string[] => [
  `sourceAssetId=${materialization.sourceAsset.sourceAssetId}`,
  `sourceAssetIndex=${materialization.sourceAssetIndex}`,
  `materializationIndex=${materialization.materializationIndex}`,
  `materializationId=${materialization.materialization.materializationId}`,
  `sourceLayerId=${materialization.materialization.sourceLayerRef.sourceLayerId}`,
  `mediaType=${materialization.materialization.mediaType}`,
  `byteLength=${materialization.materialization.byteLength}`,
  `digest=${formatDigest(materialization.materialization.digest)}`,
  `binaryAssetId=${materialization.materialization.binaryAssetRef?.binaryAssetId ?? "missing"}`,
  `textureId=${materialization.materialization.textureId ?? "missing"}`
];

const createBinaryAssetRefEvidence = (
  binaryAssetRef: BinaryAssetReferenceDto
): readonly string[] => [
  `binaryAssetId=${binaryAssetRef.binaryAssetId}`,
  `packageRelativePath=${binaryAssetRef.packageRelativePath}`,
  `binaryDigest=${formatDigest(binaryAssetRef.digest)}`,
  `binaryByteLength=${binaryAssetRef.byteLength}`,
  `binaryMediaType=${binaryAssetRef.mediaType}`,
  `storageStatus=${binaryAssetRef.storageStatus}`,
  `provenanceId=${binaryAssetRef.provenanceId}`,
  `rightsAssetId=${binaryAssetRef.rightsAssetId}`
];

const createBatchTargetPath = (context: BatchValidationContext): string =>
  `/session/psdLayerMaterializationBatchEvidence/${context.batchIndex}`;

const createEntryTargetPath = (
  context: BatchValidationContext,
  entryIndex: number,
  suffix?: string
): string =>
  `${createBatchTargetPath(context)}/entries/${entryIndex}` +
  (suffix === undefined ? "" : `/${suffix}`);

const createMaterializationKey = (
  sourceAssetId: string,
  materializationId: string
): string => `${sourceAssetId}:${materializationId}`;

const createSourceLayerKey = (
  sourceLayerRef: PsdLayerMaterializationBatchEntryDto["sourceLayerRef"]
): string => `${sourceLayerRef.sourceAssetId}:${sourceLayerRef.sourceLayerId}`;

const parseSourceAssetSha256ContentHash = (
  contentHash: string
): BinaryAssetDigestDto | undefined => {
  const match = /^sha256:([a-f0-9]{64})$/.exec(contentHash);
  return match === null
    ? undefined
    : {
        algorithm: "sha256",
        hex: match[1]!
      };
};

const sameDigest = (
  left: BinaryAssetDigestDto | undefined,
  right: BinaryAssetDigestDto | undefined
): boolean =>
  left !== undefined &&
  right !== undefined &&
  left.algorithm === right.algorithm &&
  left.hex === right.hex;

const formatDigest = (digest: BinaryAssetDigestDto | undefined): string =>
  digest === undefined ? "missing" : `${digest.algorithm}:${digest.hex}`;
