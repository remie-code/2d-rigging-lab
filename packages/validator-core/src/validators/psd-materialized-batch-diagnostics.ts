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
  PsdImportPlanApprovalBridgeEvidenceDto,
  PsdImportPlanApprovedLeafRefDto,
  PsdImportPlanCandidateDto,
  PsdImportPlanGeneratedScaffoldDto,
  PsdImportPlanSourcePsdIdentityDto,
  PsdLayerMaterializationEvidenceDto,
  SourceAssetDto,
  TextureAtlasEntryDto
} from "@private-2d-rigging-lab/package-format";
import {
  PsdImportPlanApprovalBridgeEvidenceSchema,
  PsdSourceLayerReferenceSchema
} from "@private-2d-rigging-lab/package-format";
import { z } from "zod";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

const WAVE47_RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";
const PSD_BATCH_SELECTED_LAYER_LIMIT = 4;
const PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT = 32 * 1024 * 1024;
const IMPORT_PLAN_BLOCKING_CANDIDATE_STATUSES = new Set<string>([
  "hidden",
  "unsupported",
  "emptyZeroSize",
  "duplicateRef",
  "generatedIdCollision",
  "generatedNameCollision",
  "byteCapBlocked"
]);
const IMPORT_PLAN_REVIEW_CANDIDATE_STATUSES = new Set<string>([
  "hidden",
  "unsupported",
  "emptyZeroSize",
  "duplicateRef",
  "duplicateName",
  "generatedIdCollision",
  "generatedNameCollision",
  "byteCapBlocked",
  "notApproved"
]);

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
  importPlanBridge: z.unknown().optional(),
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
  readonly requireImportPlanBridgeEvidence?: boolean;
}

export const validatePsdMaterializedBatchDiagnostics = (
  input: PsdMaterializedBatchDiagnosticsInput
): readonly ValidationCheckResultDto[] => {
  const evidence = input.batchEvidence ?? [];
  if (evidence.length === 0) {
    return [
      ...(input.requireBatchEvidence === true
        ? [createBatchEvidenceMissingCheck(input.packageDocument)]
        : []),
      ...(input.requireImportPlanBridgeEvidence === true
        ? [createImportPlanBridgeEvidenceMissingCheck(input.packageDocument)]
        : [])
    ];
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
      batchIndex,
      requireImportPlanBridgeEvidence: input.requireImportPlanBridgeEvidence === true
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
  readonly requireImportPlanBridgeEvidence: boolean;
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
    ...validateImportPlanBridgeEvidence(context),
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

interface ImportPlanBridgeValidationContext extends BatchValidationContext {
  readonly bridge: PsdImportPlanApprovalBridgeEvidenceDto;
}

interface ImportPlanCandidateCounts {
  readonly candidateCount: number;
  readonly notApprovedCandidateCount: number;
  readonly blockedCandidateCount: number;
  readonly hiddenCandidateCount: number;
  readonly unsupportedCandidateCount: number;
  readonly duplicateNameCount: number;
  readonly duplicateRefCount: number;
  readonly generatedIdCollisionCount: number;
  readonly generatedNameCollisionCount: number;
  readonly byteCapBlockedCount: number;
}

const validateImportPlanBridgeEvidence = (
  context: BatchValidationContext
): readonly ValidationCheckResultDto[] => {
  const bridge = context.batch.importPlanBridge;
  if (bridge === undefined) {
    return context.requireImportPlanBridgeEvidence
      ? [createBatchImportPlanBridgeEvidenceMissingCheck(context)]
      : [];
  }

  const parsed = PsdImportPlanApprovalBridgeEvidenceSchema.safeParse(bridge);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) =>
      `${issue.path.join(".") || "<root>"}:${issue.message}`
    );

    return [
      createImportPlanBridgeEvidenceMismatchCheck({ context, issues }),
      ...createImportPlanMalformedProvenanceChecks({ context, issues })
    ];
  }

  const bridgeContext = {
    ...context,
    bridge: parsed.data
  };

  return [
    ...validateImportPlanSourceIdentity(bridgeContext),
    ...validateImportPlanCandidateSummary(bridgeContext),
    ...validateImportPlanApprovalState(bridgeContext),
    ...validateImportPlanPreflightState(bridgeContext),
    ...validateImportPlanSelectedEntries(bridgeContext)
  ];
};

const validateImportPlanSourceIdentity = (
  context: ImportPlanBridgeValidationContext
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const sourceAssetRecord = context.indexes.sourceAssetsById.get(context.batch.sourceAssetId);
  const sourceAsset = sourceAssetRecord?.sourceAsset;
  const expectedSourceDigest =
    sourceAsset?.binaryAssetRef?.digest ??
    (sourceAsset === undefined ? undefined : parseSourceAssetSha256ContentHash(sourceAsset.contentHash));
  const expectedSourceByteLength = sourceAsset?.binaryAssetRef?.byteLength;
  const sourceStaleReasons = [
    ...(sourceAsset === undefined ? ["source-asset-missing"] : []),
    ...(context.bridge.candidatePlan.sourcePsd.sourceAssetId === context.batch.sourceAssetId
      ? []
      : ["candidate-plan-source-asset-mismatch"]),
    ...(context.bridge.approval.sourcePsd.sourceAssetId === context.batch.sourceAssetId
      ? []
      : ["approval-source-asset-mismatch"]),
    ...(sameImportPlanSourcePsdIdentity(
      context.bridge.candidatePlan.sourcePsd,
      context.bridge.approval.sourcePsd
    )
      ? []
      : ["candidate-approval-source-psd-mismatch"]),
    ...(expectedSourceDigest !== undefined &&
    !sameDigest(context.bridge.candidatePlan.sourcePsd.digest, expectedSourceDigest)
      ? ["candidate-plan-source-digest-mismatch"]
      : []),
    ...(expectedSourceDigest !== undefined &&
    !sameDigest(context.bridge.approval.sourcePsd.digest, expectedSourceDigest)
      ? ["approval-source-digest-mismatch"]
      : []),
    ...(expectedSourceByteLength !== undefined &&
    context.bridge.candidatePlan.sourcePsd.byteLength !== expectedSourceByteLength
      ? ["candidate-plan-source-byte-length-mismatch"]
      : []),
    ...(expectedSourceByteLength !== undefined &&
    context.bridge.approval.sourcePsd.byteLength !== expectedSourceByteLength
      ? ["approval-source-byte-length-mismatch"]
      : [])
  ];

  if (sourceStaleReasons.length > 0) {
    checks.push(createImportPlanIssueCheck({
      context,
      checkId: "asset.psd.importPlanSourceStale",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${createBatchTargetPath(context)}/importPlanBridge`,
      message:
        `PSD import plan ${context.bridge.candidatePlan.planId} source identity does not match the current batch source PSD evidence.`,
      evidence: [
        ...createImportPlanBridgeEvidence(context.bridge),
        `batchSourceAssetId=${context.batch.sourceAssetId}`,
        `sourceAssetMatch=${sourceAsset === undefined ? "missing" : "present"}`,
        `expectedSourceDigest=${formatDigest(expectedSourceDigest)}`,
        `candidatePlanSourceDigest=${formatDigest(context.bridge.candidatePlan.sourcePsd.digest)}`,
        `approvalSourceDigest=${formatDigest(context.bridge.approval.sourcePsd.digest)}`,
        `expectedSourceByteLength=${expectedSourceByteLength ?? "unavailable"}`,
        `candidatePlanSourceByteLength=${context.bridge.candidatePlan.sourcePsd.byteLength}`,
        `approvalSourceByteLength=${context.bridge.approval.sourcePsd.byteLength}`,
        `reasons=${sourceStaleReasons.join(",")}`
      ],
      impact:
        "Product Preflight cannot trust import-plan approval evidence when its source PSD identity is stale or mismatched."
    }));
  }

  if (
    sourceAsset !== undefined &&
    (
      sourceAsset.binaryAssetRef === undefined ||
      sourceAsset.binaryAssetRef.storageStatus !== "stored-package-local-v1"
    )
  ) {
    checks.push(createImportPlanIssueCheck({
      context,
      checkId: "asset.psd.importPlanSourceCurrentBytesMissing",
      status: "warning",
      severity: "warning",
      phase: "source_import",
      targetPath: `/assets/sourceManifest/sourceAssets/${sourceAssetRecord?.index ?? "unknown"}/binaryAssetRef`,
      message:
        `PSD import plan ${context.bridge.candidatePlan.planId} source ${sourceAsset.sourceAssetId} has no current package-local source bytes for re-plan or re-materialization.`,
      evidence: [
        ...createImportPlanBridgeEvidence(context.bridge),
        `sourceBinaryAssetRef=${sourceAsset.binaryAssetRef?.binaryAssetId ?? "missing"}`,
        `sourceBinaryStorageStatus=${sourceAsset.binaryAssetRef?.storageStatus ?? "missing"}`,
        "sourcePsdBytePersistence=metadataOnlyNoRawBytes",
        "rePlanRequiresReupload=true"
      ],
      impact:
        "Existing materialized layers may still be usable, but Product Preflight must not claim import-plan revalidation can run without reupload or reselection."
    }));
  }

  return checks;
};

const validateImportPlanCandidateSummary = (
  context: ImportPlanBridgeValidationContext
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const actualCounts = countImportPlanCandidates(context.bridge.candidatePlan.candidates);
  const summary = context.bridge.candidatePlan.summary;
  const summaryMismatchReasons = [
    ...(summary.candidateCount === actualCounts.candidateCount ? [] : ["candidate-count-mismatch"]),
    ...(summary.notApprovedCandidateCount === actualCounts.notApprovedCandidateCount
      ? []
      : ["not-approved-count-mismatch"]),
    ...(summary.blockedCandidateCount === actualCounts.blockedCandidateCount
      ? []
      : ["blocked-count-mismatch"]),
    ...(summary.hiddenCandidateCount === actualCounts.hiddenCandidateCount
      ? []
      : ["hidden-count-mismatch"]),
    ...(summary.unsupportedCandidateCount === actualCounts.unsupportedCandidateCount
      ? []
      : ["unsupported-count-mismatch"]),
    ...(summary.duplicateNameCount === actualCounts.duplicateNameCount
      ? []
      : ["duplicate-name-count-mismatch"]),
    ...(summary.duplicateRefCount === actualCounts.duplicateRefCount
      ? []
      : ["duplicate-ref-count-mismatch"]),
    ...(summary.generatedIdCollisionCount === actualCounts.generatedIdCollisionCount
      ? []
      : ["generated-id-collision-count-mismatch"]),
    ...(summary.generatedNameCollisionCount === actualCounts.generatedNameCollisionCount
      ? []
      : ["generated-name-collision-count-mismatch"]),
    ...(summary.byteCapBlockedCount === actualCounts.byteCapBlockedCount
      ? []
      : ["byte-cap-blocked-count-mismatch"])
  ];

  if (summaryMismatchReasons.length > 0) {
    checks.push(createImportPlanIssueCheck({
      context,
      checkId: "asset.psd.importPlanCandidateMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${createBatchTargetPath(context)}/importPlanBridge/candidatePlan/summary`,
      message:
        `PSD import plan ${context.bridge.candidatePlan.planId} candidate summary does not match its candidate list.`,
      evidence: [
        ...createImportPlanBridgeEvidence(context.bridge),
        ...createCandidateSummaryEvidence(summary, actualCounts),
        `reasons=${summaryMismatchReasons.join(",")}`
      ],
      impact:
        "Product Preflight cannot trust import-plan candidate status totals when the parser-free summary contradicts per-candidate evidence."
    }));
  }

  const reviewReasons = [
    ...(summary.notApprovedCandidateCount > 0 ? ["not-approved-candidates-present"] : []),
    ...(summary.hiddenCandidateCount > 0 ? ["hidden-candidates-present"] : []),
    ...(summary.unsupportedCandidateCount > 0 ? ["unsupported-candidates-present"] : []),
    ...(summary.duplicateNameCount > 0 ? ["duplicate-name-candidates-present"] : []),
    ...(summary.duplicateRefCount > 0 ? ["duplicate-ref-candidates-present"] : []),
    ...(summary.generatedIdCollisionCount > 0 ? ["generated-id-collision-candidates-present"] : []),
    ...(summary.generatedNameCollisionCount > 0 ? ["generated-name-collision-candidates-present"] : []),
    ...(summary.byteCapBlockedCount > 0 ? ["byte-cap-blocked-candidates-present"] : []),
    ...(context.bridge.approval.notApprovedCandidates.length > 0
      ? ["approval-not-approved-candidate-summary-present"]
      : []),
    ...(context.bridge.approval.blockedCandidates.length > 0
      ? ["approval-blocked-candidate-summary-present"]
      : []),
    ...createCollisionPreflightReviewReasons(context.bridge.approval.collisionPreflight)
  ];

  if (reviewReasons.length > 0) {
    checks.push(createImportPlanIssueCheck({
      context,
      checkId: "asset.psd.importPlanCandidateStatusSummary",
      status: "warning",
      severity: "warning",
      phase: "source_import",
      targetPath: `${createBatchTargetPath(context)}/importPlanBridge/candidatePlan/summary`,
      message:
        `PSD import plan ${context.bridge.candidatePlan.planId} records non-approved or blocked candidate states that were not silently imported.`,
      evidence: [
        ...createImportPlanBridgeEvidence(context.bridge),
        ...createCandidateSummaryEvidence(summary, actualCounts),
        ...createCollisionPreflightEvidence(context.bridge.approval.collisionPreflight),
        `notApprovedCandidateRefs=${formatCandidateRefs(context.bridge.approval.notApprovedCandidates)}`,
        `blockedCandidateRefs=${formatCandidateRefs(context.bridge.approval.blockedCandidates)}`,
        `reasons=${reviewReasons.join(",")}`
      ],
      impact:
        "Product Preflight surfaces import-plan preview states as reviewable evidence without treating not-approved, hidden, unsupported, collision, or byte-cap-blocked candidates as materialized assets."
    }));
  }

  return checks;
};

const validateImportPlanApprovalState = (
  context: ImportPlanBridgeValidationContext
): readonly ValidationCheckResultDto[] => {
  const candidateMismatchReasons = [
    ...(sameDigest(
      context.bridge.candidatePlan.candidatePlanDigest,
      context.bridge.approval.candidatePlanDigest
    )
      ? []
      : ["candidate-plan-digest-mismatch"])
  ];
  const approvalMismatchReasons = [
    ...(context.bridge.approval.approvalStatus === "approved"
      ? []
      : [`approval-status-${context.bridge.approval.approvalStatus}`]),
    ...(context.bridge.approval.approvedLeafRefs.length === context.batch.entries.length
      ? []
      : ["approved-leaf-count-mismatch"]),
    ...(context.bridge.approval.destination.parentPartId === context.batch.destination.parentPartId
      ? []
      : ["approval-destination-parent-mismatch"]),
    ...createApprovedLeafEntryMismatchReasons(context)
  ];
  const checks: ValidationCheckResultDto[] = [];

  if (candidateMismatchReasons.length > 0) {
    checks.push(createImportPlanIssueCheck({
      context,
      checkId: "asset.psd.importPlanCandidateMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${createBatchTargetPath(context)}/importPlanBridge/approval/candidatePlanDigest`,
      message:
        `PSD import plan approval ${context.bridge.approval.approvalId} does not reference the supplied candidate plan digest.`,
      evidence: [
        ...createImportPlanBridgeEvidence(context.bridge),
        `reasons=${candidateMismatchReasons.join(",")}`
      ],
      impact:
        "Product Preflight cannot trust approval evidence when it may refer to a different candidate plan."
    }));
  }

  if (approvalMismatchReasons.length > 0) {
    checks.push(createImportPlanIssueCheck({
      context,
      checkId: "asset.psd.importPlanApprovalMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${createBatchTargetPath(context)}/importPlanBridge/approval`,
      message:
        `PSD import plan approval ${context.bridge.approval.approvalId} does not match the batch entries or required approved status.`,
      evidence: [
        ...createImportPlanBridgeEvidence(context.bridge),
        `approvalStatus=${context.bridge.approval.approvalStatus}`,
        `approvedLeafCount=${context.bridge.approval.approvedLeafRefs.length}`,
        `batchEntryCount=${context.batch.entries.length}`,
        `approvalDestinationParentPartId=${context.bridge.approval.destination.parentPartId}`,
        `batchDestinationParentPartId=${context.batch.destination.parentPartId}`,
        `reasons=${approvalMismatchReasons.join(",")}`
      ],
      impact:
        "Only the explicit approved leaf refs for the current candidate plan may be passed to batch materialization."
    }));
  }

  return checks;
};

const validateImportPlanPreflightState = (
  context: ImportPlanBridgeValidationContext
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  if (
    context.bridge.approval.approvalStatus === "preflightBlocked" ||
    context.batch.aggregateStatus === "preflightBlocked" ||
    context.batch.aggregateStatus === "failure"
  ) {
    checks.push(createImportPlanIssueCheck({
      context,
      checkId: "asset.psd.importPlanPreflightBlocked",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${createBatchTargetPath(context)}/importPlanBridge/approval/collisionPreflight`,
      message:
        `PSD import plan approval ${context.bridge.approval.approvalId} or its batch execution is preflight-blocked.`,
      evidence: [
        ...createImportPlanBridgeEvidence(context.bridge),
        ...createCollisionPreflightEvidence(context.bridge.approval.collisionPreflight),
        `approvalStatus=${context.bridge.approval.approvalStatus}`,
        `batchAggregateStatus=${context.batch.aggregateStatus}`,
        "batchMutationPolicy=preflightBlocksOnAnyFailure"
      ],
      impact:
        "Product Preflight must not treat collision, byte-cap, approval, or preflight-blocked import-plan evidence as available materialized bytes."
    }));
  }

  if (context.batch.aggregateStatus === "partialFailure") {
    checks.push(createImportPlanIssueCheck({
      context,
      checkId: "asset.psd.importPlanPartialState",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: createBatchTargetPath(context),
      message:
        `PSD import plan approval ${context.bridge.approval.approvalId} led to a partial batch state.`,
      evidence: [
        ...createImportPlanBridgeEvidence(context.bridge),
        `batchAggregateStatus=${context.batch.aggregateStatus}`,
        `successCount=${context.batch.successCount}`,
        `failureCount=${context.batch.failureCount}`,
        "silentPartialSuccess=forbidden"
      ],
      impact:
        "Product Preflight must block import-plan evidence that mixes committed or materialized entries with failed entries."
    }));
  }

  return checks;
};

const validateImportPlanSelectedEntries = (
  context: ImportPlanBridgeValidationContext
): readonly ValidationCheckResultDto[] => {
  const candidateByLayerKey = new Map(
    context.bridge.candidatePlan.candidates.map((candidate) => [
      createSourceLayerKey(candidate.sourceLayerRef),
      candidate
    ])
  );
  const notApprovedLayerKeys = new Set(
    context.bridge.approval.notApprovedCandidates.map((candidate) =>
      createSourceLayerKey(candidate.sourceLayerRef)
    )
  );
  const blockedLayerKeys = new Set(
    context.bridge.approval.blockedCandidates.map((candidate) =>
      createSourceLayerKey(candidate.sourceLayerRef)
    )
  );

  return context.batch.entries.flatMap((entry, entryIndex) => {
    const sourceLayerKey = createSourceLayerKey(entry.sourceLayerRef);
    const approvedLeaf = context.bridge.approval.approvedLeafRefs[entry.selectedIndex];
    const candidate = candidateByLayerKey.get(sourceLayerKey);

    return [
      ...(candidate === undefined
        ? [createImportPlanEntryIssueCheck({
            context,
            entry,
            entryIndex,
            checkId: "asset.psd.importPlanCandidateMismatch",
            status: "fail",
            severity: "error",
            phase: "source_import",
            targetPath: `${createEntryTargetPath(context, entryIndex)}/sourceLayerRef`,
            message:
              `PSD import plan ${context.bridge.candidatePlan.planId} has no candidate for selected batch layer ${sourceLayerKey}.`,
            evidence: [
              ...createImportPlanBridgeEvidence(context.bridge),
              `selectedSourceLayerKey=${sourceLayerKey}`,
              "reason=selected-layer-missing-from-candidate-plan"
            ],
            impact:
              "Product Preflight cannot verify that this selected layer came from the parser-free candidate plan."
          })]
        : []),
      ...(candidate === undefined
        ? []
        : validateImportPlanSelectedCandidateStatuses({
            context,
            entry,
            entryIndex,
            sourceLayerKey,
            candidate,
            approvedLeaf,
            notApprovedLayerKeys,
            blockedLayerKeys
          })),
      ...validateImportPlanSelectedEntryApproval({
        context,
        entry,
        entryIndex,
        sourceLayerKey,
        candidate,
        approvedLeaf
      })
    ];
  });
};

const validateImportPlanSelectedCandidateStatuses = (input: {
  readonly context: ImportPlanBridgeValidationContext;
  readonly entry: PsdLayerMaterializationBatchEntryDto;
  readonly entryIndex: number;
  readonly sourceLayerKey: string;
  readonly candidate: PsdImportPlanCandidateDto;
  readonly approvedLeaf: PsdImportPlanApprovedLeafRefDto | undefined;
  readonly notApprovedLayerKeys: ReadonlySet<string>;
  readonly blockedLayerKeys: ReadonlySet<string>;
}): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const candidateBlockingStatuses = input.candidate.statuses.filter((status) =>
    IMPORT_PLAN_BLOCKING_CANDIDATE_STATUSES.has(status)
  );
  const approvalBlockingStatuses = input.approvedLeaf?.candidateStatuses.filter((status) =>
    IMPORT_PLAN_BLOCKING_CANDIDATE_STATUSES.has(status)
  ) ?? [];
  const generatedStatus = input.approvedLeaf?.resolvedGeneratedIds?.status ??
    input.approvedLeaf?.generatedScaffoldPreview?.status ??
    input.candidate.generatedScaffoldPreview?.status;
  const generatedBlockingStatuses = generatedStatus === "generatedIdCollision" ||
    generatedStatus === "generatedNameCollision"
    ? [generatedStatus]
    : [];
  const blockingStatuses = uniqueStrings([
    ...candidateBlockingStatuses,
    ...approvalBlockingStatuses,
    ...generatedBlockingStatuses,
    ...(input.blockedLayerKeys.has(input.sourceLayerKey) ? ["blockedCandidateSummary"] : [])
  ]);

  if (blockingStatuses.length > 0) {
    checks.push(createImportPlanEntryIssueCheck({
      context: input.context,
      entry: input.entry,
      entryIndex: input.entryIndex,
      checkId: "asset.psd.importPlanCandidateBlocked",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${createEntryTargetPath(input.context, input.entryIndex)}/sourceLayerRef`,
      message:
        `PSD import plan selected layer ${input.sourceLayerKey} carries hidden, unsupported, collision, empty, duplicate, or byte-cap-blocked candidate status.`,
      evidence: [
        ...createImportPlanBridgeEvidence(input.context.bridge),
        ...createCandidateEvidence(input.candidate),
        `approvedLeafCandidateStatuses=${input.approvedLeaf?.candidateStatuses.join(",") ?? "missing"}`,
        `blockingStatuses=${blockingStatuses.join(",")}`
      ],
      impact:
        "Product Preflight must block hidden, unsupported, empty, duplicate-ref, generated-collision, and byte-cap-blocked candidates from materialization."
    }));
  }

  if (
    input.notApprovedLayerKeys.has(input.sourceLayerKey) ||
    input.approvedLeaf?.candidateStatuses.includes("notApproved") === true
  ) {
    checks.push(createImportPlanEntryIssueCheck({
      context: input.context,
      entry: input.entry,
      entryIndex: input.entryIndex,
      checkId: "asset.psd.importPlanNotApprovedCandidateSelected",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${createEntryTargetPath(input.context, input.entryIndex)}/sourceLayerRef`,
      message:
        `PSD import plan selected layer ${input.sourceLayerKey} is recorded as not approved and must not be imported.`,
      evidence: [
        ...createImportPlanBridgeEvidence(input.context.bridge),
        ...createCandidateEvidence(input.candidate),
        `approvedLeafCandidateStatuses=${input.approvedLeaf?.candidateStatuses.join(",") ?? "missing"}`,
        `notApprovedCandidateRefs=${formatCandidateRefs(input.context.bridge.approval.notApprovedCandidates)}`,
        "reason=not-approved-candidate-selected"
      ],
      impact:
        "Only explicit approved leaf refs may be passed from import-plan preview to batch materialization."
    }));
  }

  return checks;
};

const validateImportPlanSelectedEntryApproval = (input: {
  readonly context: ImportPlanBridgeValidationContext;
  readonly entry: PsdLayerMaterializationBatchEntryDto;
  readonly entryIndex: number;
  readonly sourceLayerKey: string;
  readonly candidate: PsdImportPlanCandidateDto | undefined;
  readonly approvedLeaf: PsdImportPlanApprovedLeafRefDto | undefined;
}): readonly ValidationCheckResultDto[] => {
  const mismatchReasons = [
    ...(input.approvedLeaf === undefined ? ["approved-leaf-missing"] : []),
    ...(input.approvedLeaf !== undefined &&
    input.approvedLeaf.approvalOrder !== input.entry.selectedIndex
      ? ["approval-order-mismatch"]
      : []),
    ...(input.approvedLeaf !== undefined &&
    createSourceLayerKey(input.approvedLeaf.sourceLayerRef) !== input.sourceLayerKey
      ? ["approved-leaf-source-ref-mismatch"]
      : []),
    ...createGeneratedApprovalMismatchReasons(input.entry, input.candidate, input.approvedLeaf),
    ...createMaterializationImportPlanSourceMismatchReasons(input.context, input.entry)
  ];

  if (mismatchReasons.length === 0) {
    return [];
  }

  return [
    createImportPlanEntryIssueCheck({
      context: input.context,
      entry: input.entry,
      entryIndex: input.entryIndex,
      checkId: mismatchReasons.some((reason) => reason.startsWith("materialization-source"))
        ? "asset.psd.importPlanSourceStale"
        : "asset.psd.importPlanApprovalMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${createEntryTargetPath(input.context, input.entryIndex)}/sourceLayerRef`,
      message:
        `PSD import plan approval ${input.context.bridge.approval.approvalId} does not match selected batch entry ${input.entryIndex}.`,
      evidence: [
        ...createImportPlanBridgeEvidence(input.context.bridge),
        `selectedSourceLayerKey=${input.sourceLayerKey}`,
        `approvedLeafSourceLayerKey=${
          input.approvedLeaf === undefined
            ? "missing"
            : createSourceLayerKey(input.approvedLeaf.sourceLayerRef)
        }`,
        `approvedLeafApprovalOrder=${input.approvedLeaf?.approvalOrder ?? "missing"}`,
        ...createExpectedGeneratedEvidence(input.candidate, input.approvedLeaf),
        `reasons=${mismatchReasons.join(",")}`
      ],
      impact:
        "Product Preflight cannot trust batch execution that diverges from the approved parser-free import plan."
    })
  ];
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

const createImportPlanMalformedProvenanceChecks = (input: {
  readonly context: BatchValidationContext;
  readonly issues: readonly string[];
}): readonly ValidationCheckResultDto[] => {
  const provenanceIssues = input.issues.filter((issue) =>
    issue.includes("sourcePsd.publicDemoAsset") ||
    issue.includes("sourcePsd.sourceBytePersistence") ||
    issue.includes("boundary.publicDemoAsset") ||
    issue.includes("boundary.sourcePsdBytePersistence") ||
    issue.includes("boundary.rawParserObjectPersistence")
  );

  if (provenanceIssues.length === 0) {
    return [];
  }

  return [
    createImportPlanIssueCheck({
      context: input.context,
      checkId: "asset.psd.importPlanProvenanceBlocked",
      status: "fail",
      severity: "error",
      phase: "rights",
      targetPath: `${createBatchTargetPath(input.context)}/importPlanBridge`,
      message:
        `PSD import plan bridge evidence in batch ${input.context.batch.batchId} lacks required private/local non-public boundary fields.`,
      evidence: [
        `schemaIssues=${provenanceIssues.join("|")}`,
        "requiredSourceBytePersistence=metadataOnlyNoRawBytes",
        "requiredPublicDemoAsset=false",
        "rawParserObjectPersistence=notPersisted",
        "reason=private-local-import-plan-boundary-missing"
      ],
      impact:
        "Product Preflight must not treat import-plan evidence as usable without explicit non-public provenance and no raw parser/source-byte persistence."
    })
  ];
};

const createImportPlanBridgeEvidenceMismatchCheck = (input: {
  readonly context: BatchValidationContext;
  readonly issues: readonly string[];
}): ValidationCheckResultDto =>
  createImportPlanIssueCheck({
    context: input.context,
    checkId: "asset.psd.importPlanEvidenceMismatch",
    status: "fail",
    severity: "error",
    phase: "source_import",
    targetPath: `${createBatchTargetPath(input.context)}/importPlanBridge`,
    message:
      `PSD import plan bridge evidence in batch ${input.context.batch.batchId} does not match the Wave48 parser-free evidence schema.`,
    evidence: [
      `schemaIssues=${input.issues.join("|")}`,
      "requiredEvidence=psdImportPlanApprovalBridgeEvidence",
      "validatorBoundary=no-parser-execution",
      "productPreflightPersistence=sessionOnly"
    ],
    impact:
      "Product Preflight cannot trust malformed import-plan candidate or approval evidence, and it must not infer parser/runtime details."
  });

const createImportPlanBridgeEvidenceMissingCheck = (
  packageDocument: PackageDocumentDto
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "asset.psd.importPlanEvidenceMissing",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    target: {
      kind: "package",
      id: packageDocument.manifest.packageId
    },
    targetPath: "/session/psdImportPlanApprovalBridgeEvidence",
    message:
      "No session PSD import-plan approval bridge evidence was supplied for Product Preflight.",
    evidence: [
      "importPlanEvidenceAvailability=not_evaluated",
      "requiredEvidence=psdImportPlanApprovalBridgeEvidence",
      "validatorBoundary=no-parser-execution",
      "rawParserObject=notPersisted",
      "sourcePsdBytes=notPersisted",
      "productPreflightPersistence=sessionOnly"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003"],
    impact:
      "Product Preflight must report import-plan approval as not evaluated until session bridge evidence is supplied."
  });

const createBatchImportPlanBridgeEvidenceMissingCheck = (
  context: BatchValidationContext
): ValidationCheckResultDto =>
  createImportPlanIssueCheck({
    context,
    checkId: "asset.psd.importPlanEvidenceMissing",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    targetPath: `${createBatchTargetPath(context)}/importPlanBridge`,
    message:
      `PSD materialization batch ${context.batch.batchId} has no import-plan approval bridge evidence.`,
    evidence: createBatchSummaryEvidence(context, [
      "importPlanEvidenceAvailability=not_evaluated",
      "requiredEvidence=psdImportPlanApprovalBridgeEvidence",
      "productPreflightPersistence=sessionOnly"
    ]),
    impact:
      "Product Preflight can keep Wave47 batch evidence compatible, but Wave48 import-plan approval cannot be evaluated without parser-free bridge evidence."
  });

const countImportPlanCandidates = (
  candidates: readonly PsdImportPlanCandidateDto[]
): ImportPlanCandidateCounts => ({
  candidateCount: candidates.length,
  notApprovedCandidateCount: candidates.filter((candidate) =>
    candidate.statuses.includes("notApproved")
  ).length,
  blockedCandidateCount: candidates.filter((candidate) =>
    candidate.statuses.some((status) => IMPORT_PLAN_BLOCKING_CANDIDATE_STATUSES.has(status))
  ).length,
  hiddenCandidateCount: candidates.filter((candidate) =>
    candidate.statuses.includes("hidden")
  ).length,
  unsupportedCandidateCount: candidates.filter((candidate) =>
    candidate.statuses.includes("unsupported")
  ).length,
  duplicateNameCount: countDuplicateDisplayNameGroups(candidates),
  duplicateRefCount: countDuplicateSourceLayerRefGroups(candidates),
  generatedIdCollisionCount: candidates.filter((candidate) =>
    candidate.statuses.includes("generatedIdCollision") ||
    candidate.generatedScaffoldPreview?.status === "generatedIdCollision"
  ).length,
  generatedNameCollisionCount: candidates.filter((candidate) =>
    candidate.statuses.includes("generatedNameCollision") ||
    candidate.generatedScaffoldPreview?.status === "generatedNameCollision"
  ).length,
  byteCapBlockedCount: candidates.filter((candidate) =>
    candidate.statuses.includes("byteCapBlocked")
  ).length
});

const countDuplicateDisplayNameGroups = (
  candidates: readonly PsdImportPlanCandidateDto[]
): number =>
  countDuplicateGroups(candidates.map((candidate) =>
    getCandidateDisplayName(candidate).trim().toLocaleLowerCase()
  ));

const countDuplicateSourceLayerRefGroups = (
  candidates: readonly PsdImportPlanCandidateDto[]
): number =>
  countDuplicateGroups(candidates.map((candidate) =>
    createSourceLayerKey(candidate.sourceLayerRef)
  ));

const countDuplicateGroups = (values: readonly string[]): number => {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return [...counts.values()].filter((count) => count > 1).length;
};

const createCandidateSummaryEvidence = (
  summary: PsdImportPlanApprovalBridgeEvidenceDto["candidatePlan"]["summary"],
  actualCounts: ImportPlanCandidateCounts
): readonly string[] => [
  `summaryCandidateCount=${summary.candidateCount}`,
  `actualCandidateCount=${actualCounts.candidateCount}`,
  `summaryNotApprovedCandidateCount=${summary.notApprovedCandidateCount}`,
  `actualNotApprovedCandidateCount=${actualCounts.notApprovedCandidateCount}`,
  `summaryBlockedCandidateCount=${summary.blockedCandidateCount}`,
  `actualBlockedCandidateCount=${actualCounts.blockedCandidateCount}`,
  `summaryHiddenCandidateCount=${summary.hiddenCandidateCount}`,
  `actualHiddenCandidateCount=${actualCounts.hiddenCandidateCount}`,
  `summaryUnsupportedCandidateCount=${summary.unsupportedCandidateCount}`,
  `actualUnsupportedCandidateCount=${actualCounts.unsupportedCandidateCount}`,
  `summaryDuplicateNameCount=${summary.duplicateNameCount}`,
  `actualDuplicateNameCount=${actualCounts.duplicateNameCount}`,
  `summaryDuplicateRefCount=${summary.duplicateRefCount}`,
  `actualDuplicateRefCount=${actualCounts.duplicateRefCount}`,
  `summaryGeneratedIdCollisionCount=${summary.generatedIdCollisionCount}`,
  `actualGeneratedIdCollisionCount=${actualCounts.generatedIdCollisionCount}`,
  `summaryGeneratedNameCollisionCount=${summary.generatedNameCollisionCount}`,
  `actualGeneratedNameCollisionCount=${actualCounts.generatedNameCollisionCount}`,
  `summaryByteCapBlockedCount=${summary.byteCapBlockedCount}`,
  `actualByteCapBlockedCount=${actualCounts.byteCapBlockedCount}`,
  `totalByteEstimate=${summary.totalByteEstimate ?? "missing"}`,
  `approvedByteEstimate=${summary.approvedByteEstimate ?? "missing"}`
];

const createCollisionPreflightReviewReasons = (
  collisionPreflight: PsdImportPlanApprovalBridgeEvidenceDto["approval"]["collisionPreflight"]
): readonly string[] => [
  ...(collisionPreflight.duplicateRefCount > 0 ? ["collision-preflight-duplicate-ref"] : []),
  ...(collisionPreflight.duplicateNameCount > 0 ? ["collision-preflight-duplicate-name"] : []),
  ...(collisionPreflight.generatedIdCollisionCount > 0
    ? ["collision-preflight-generated-id-collision"]
    : []),
  ...(collisionPreflight.generatedNameCollisionCount > 0
    ? ["collision-preflight-generated-name-collision"]
    : []),
  ...(collisionPreflight.byteCapBlockedCount > 0 ? ["collision-preflight-byte-cap-blocked"] : []),
  ...(collisionPreflight.blockedCandidateCount > 0 ? ["collision-preflight-blocked-candidate"] : []),
  ...(collisionPreflight.notApprovedCandidateCount > 0
    ? ["collision-preflight-not-approved-candidate"]
    : []),
  ...(collisionPreflight.preflightBlockedCount > 0 ? ["collision-preflight-blocked"] : [])
];

const createCollisionPreflightEvidence = (
  collisionPreflight: PsdImportPlanApprovalBridgeEvidenceDto["approval"]["collisionPreflight"]
): readonly string[] => [
  `collisionDuplicateRefCount=${collisionPreflight.duplicateRefCount}`,
  `collisionDuplicateNameCount=${collisionPreflight.duplicateNameCount}`,
  `collisionGeneratedIdCollisionCount=${collisionPreflight.generatedIdCollisionCount}`,
  `collisionGeneratedNameCollisionCount=${collisionPreflight.generatedNameCollisionCount}`,
  `collisionByteCapBlockedCount=${collisionPreflight.byteCapBlockedCount}`,
  `collisionBlockedCandidateCount=${collisionPreflight.blockedCandidateCount}`,
  `collisionNotApprovedCandidateCount=${collisionPreflight.notApprovedCandidateCount}`,
  `collisionPreflightBlockedCount=${collisionPreflight.preflightBlockedCount}`
];

const createApprovedLeafEntryMismatchReasons = (
  context: ImportPlanBridgeValidationContext
): readonly string[] =>
  context.batch.entries.flatMap((entry) => {
    const approvedLeaf = context.bridge.approval.approvedLeafRefs[entry.selectedIndex];
    if (approvedLeaf === undefined) {
      return [`entry-${entry.selectedIndex}-approved-leaf-missing`];
    }

    const entryLayerKey = createSourceLayerKey(entry.sourceLayerRef);
    const approvedLayerKey = createSourceLayerKey(approvedLeaf.sourceLayerRef);

    return [
      ...(approvedLeaf.approvalOrder === entry.selectedIndex
        ? []
        : [`entry-${entry.selectedIndex}-approval-order-mismatch`]),
      ...(approvedLayerKey === entryLayerKey
        ? []
        : [`entry-${entry.selectedIndex}-approved-layer-ref-mismatch`])
    ];
  });

const createGeneratedApprovalMismatchReasons = (
  entry: PsdLayerMaterializationBatchEntryDto,
  candidate: PsdImportPlanCandidateDto | undefined,
  approvedLeaf: PsdImportPlanApprovedLeafRefDto | undefined
): readonly string[] => {
  const expectedGenerated = getExpectedGeneratedScaffold(candidate, approvedLeaf);
  if (expectedGenerated === undefined || generatedScaffoldMatches(entry.generated, expectedGenerated)) {
    return [];
  }

  return ["generated-scaffold-approval-mismatch"];
};

const createMaterializationImportPlanSourceMismatchReasons = (
  context: ImportPlanBridgeValidationContext,
  entry: PsdLayerMaterializationBatchEntryDto
): readonly string[] => {
  const materialization = context.indexes.materializationsByKey.get(
    createMaterializationKey(entry.sourceLayerRef.sourceAssetId, entry.materializationId)
  );
  if (materialization === undefined) {
    return [];
  }

  const provenance = materialization.materialization.provenance;

  return [
    ...(sameDigest(provenance.sourceDigest, context.bridge.approval.sourcePsd.digest)
      ? []
      : ["materialization-source-digest-import-plan-mismatch"]),
    ...(provenance.sourceByteLength === context.bridge.approval.sourcePsd.byteLength
      ? []
      : ["materialization-source-byte-length-import-plan-mismatch"])
  ];
};

const getExpectedGeneratedScaffold = (
  candidate: PsdImportPlanCandidateDto | undefined,
  approvedLeaf: PsdImportPlanApprovedLeafRefDto | undefined
): PsdImportPlanGeneratedScaffoldDto | undefined =>
  approvedLeaf?.resolvedGeneratedIds ??
  approvedLeaf?.generatedScaffoldPreview ??
  candidate?.generatedScaffoldPreview;

const generatedScaffoldMatches = (
  actual: PsdLayerMaterializationBatchGeneratedTargetsDto,
  expected: PsdImportPlanGeneratedScaffoldDto
): boolean =>
  expected.destinationKind === "generatedPartScaffold" &&
  actual.partId === expected.partId &&
  actual.partDisplayName === expected.partDisplayName &&
  actual.drawableId === expected.drawableId &&
  actual.drawableDisplayName === expected.drawableDisplayName &&
  actual.textureId === expected.textureId &&
  actual.meshId === expected.meshId;

const createImportPlanBridgeEvidence = (
  bridge: PsdImportPlanApprovalBridgeEvidenceDto
): readonly string[] => [
  `importPlanId=${bridge.candidatePlan.planId}`,
  `candidatePlanDigest=${formatDigest(bridge.candidatePlan.candidatePlanDigest)}`,
  `approvalId=${bridge.approval.approvalId}`,
  `approvalSelectionDigest=${formatDigest(bridge.approval.approvalSelectionDigest)}`,
  `approvalStatus=${bridge.approval.approvalStatus}`,
  `approvalDestinationParentPartId=${bridge.approval.destination.parentPartId}`,
  `approvedLeafRefCount=${bridge.approval.approvedLeafRefs.length}`,
  `candidatePlanScopeKind=${bridge.candidatePlan.scope.scopeRef.kind}`,
  `candidatePlanScopeId=${bridge.candidatePlan.scope.scopeRef.id ?? "missing"}`,
  "importPlanDiscoveryMode=recursiveLeafCandidatePreview",
  "onlyApprovedLeafRefsPassedToBatch=true"
];

const createCandidateEvidence = (
  candidate: PsdImportPlanCandidateDto
): readonly string[] => [
  `candidateIndex=${candidate.candidateIndex}`,
  `candidateSourceLayerKey=${createSourceLayerKey(candidate.sourceLayerRef)}`,
  `candidateSourceLayerName=${getCandidateDisplayName(candidate)}`,
  `candidateStatuses=${candidate.statuses.join(",")}`,
  `candidateStatusReasons=${candidate.statusReasons.join(",") || "none"}`,
  `approvalBlockedReasons=${candidate.approvalBlockedReasons.join(",") || "none"}`,
  `candidateByteEstimate=${candidate.byteEstimate ?? "missing"}`
];

const createExpectedGeneratedEvidence = (
  candidate: PsdImportPlanCandidateDto | undefined,
  approvedLeaf: PsdImportPlanApprovedLeafRefDto | undefined
): readonly string[] => {
  const expectedGenerated = getExpectedGeneratedScaffold(candidate, approvedLeaf);
  if (expectedGenerated === undefined) {
    return ["expectedGeneratedScaffold=missing"];
  }

  return [
    `expectedGeneratedStatus=${expectedGenerated.status}`,
    `expectedGeneratedPartId=${expectedGenerated.partId}`,
    `expectedGeneratedDrawableId=${expectedGenerated.drawableId}`,
    `expectedGeneratedMeshId=${expectedGenerated.meshId}`,
    `expectedGeneratedTextureId=${expectedGenerated.textureId}`
  ];
};

const formatCandidateRefs = (
  candidates: readonly PsdImportPlanCandidateDto[]
): string =>
  candidates.map((candidate) => createSourceLayerKey(candidate.sourceLayerRef)).join(",") || "none";

const getCandidateDisplayName = (candidate: PsdImportPlanCandidateDto): string =>
  candidate.sourceLayerName ??
  candidate.sourceLayerRef.sourceLayerName ??
  candidate.sourceLayerPath.at(-1) ??
  candidate.sourceLayerRef.sourceLayerId;

const sameImportPlanSourcePsdIdentity = (
  left: PsdImportPlanSourcePsdIdentityDto,
  right: PsdImportPlanSourcePsdIdentityDto
): boolean =>
  left.sourceAssetId === right.sourceAssetId &&
  left.byteLength === right.byteLength &&
  sameDigest(left.digest, right.digest) &&
  left.sourceBytePersistence === right.sourceBytePersistence &&
  left.publicDemoAsset === right.publicDemoAsset;

const uniqueStrings = (values: readonly string[]): readonly string[] => [...new Set(values)];

const createImportPlanIssueCheck = (input: {
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
  createBatchIssueCheck({
    context: input.context,
    checkId: input.checkId,
    status: input.status,
    severity: input.severity,
    phase: input.phase,
    targetPath: input.targetPath,
    message: input.message,
    evidence: [
      ...input.evidence,
      "importPlanEvidence=parser-free-session-evidence",
      "productPreflightPersistence=sessionOnly"
    ],
    impact: input.impact
  });

const createImportPlanEntryIssueCheck = (input: {
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
  createBatchEntryIssueCheck({
    context: input.context,
    entry: input.entry,
    entryIndex: input.entryIndex,
    checkId: input.checkId,
    status: input.status,
    severity: input.severity,
    phase: input.phase,
    targetPath: input.targetPath,
    message: input.message,
    evidence: [
      ...input.evidence,
      "importPlanEvidence=parser-free-session-evidence",
      "productPreflightPersistence=sessionOnly"
    ],
    impact: input.impact
  });

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
  sourceLayerRef: { readonly sourceAssetId: string; readonly sourceLayerId: string }
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
