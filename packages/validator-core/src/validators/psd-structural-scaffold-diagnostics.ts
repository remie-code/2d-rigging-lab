import type {
  CheckStatus,
  Severity
} from "@private-2d-rigging-lab/contracts";
import {
  OperationIdSchema,
  PartIdSchema,
  SourceAssetIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  LayeredCharacterPsdProfileDto,
  MeshDto,
  ModelPartDto,
  PackageDocumentDto,
  PsdProfileSourceGroupDto,
  PsdProfileSourceLayerDto,
  PsdStructuralScaffoldGroupPartDto,
  PsdStructuralScaffoldIssueDto,
  PsdStructuralScaffoldIssueKindDto,
  PsdStructuralScaffoldLeafDrawableDto,
  SourceAssetDto,
  SourceLayerDto,
  TextureAtlasEntryDto
} from "@private-2d-rigging-lab/package-format";
import {
  PsdStructuralScaffoldApprovalBridgeEvidenceSchema,
  PsdStructuralScaffoldGroupPartSchema,
  PsdStructuralScaffoldIssueSchema,
  PsdStructuralScaffoldLeafDrawableSchema
} from "@private-2d-rigging-lab/package-format";
import { z } from "zod";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

const PSD_STRUCTURAL_EVIDENCE_ID_PATTERN = /^evidence_[A-Za-z0-9_-]+$/;
const PSD_STRUCTURAL_BATCH_ID_PATTERN = /^batch_[A-Za-z0-9_-]+$/;
const PSD_STRUCTURAL_APPROVED_LEAF_LIMIT = 6;
const PSD_STRUCTURAL_APPROVED_GROUP_LIMIT = 32;
const PSD_STRUCTURAL_GENERATED_NODE_LIMIT = 64;
const PSD_STRUCTURAL_TOTAL_RAW_RGBA_BYTE_LIMIT = 32 * 1024 * 1024;

const PsdStructuralScaffoldOperationEvidenceSchema = z.object({
  schemaVersion: z.literal("psd-structural-scaffold-operation-evidence-v1"),
  operationType: z.literal("importPsdStructuralScaffold"),
  evidenceId: z.string().regex(PSD_STRUCTURAL_EVIDENCE_ID_PATTERN).optional(),
  operationId: OperationIdSchema.optional(),
  batchId: z.string().regex(PSD_STRUCTURAL_BATCH_ID_PATTERN),
  sourceAssetId: SourceAssetIdSchema,
  destination: z.object({
    destinationKind: z.literal("structuralScaffold"),
    parentPartId: PartIdSchema
  }).strict(),
  structuralScaffoldBridge: PsdStructuralScaffoldApprovalBridgeEvidenceSchema.optional(),
  aggregateStatus: z.enum(["success", "preflightBlocked", "failure"]),
  generatedGroupPartScaffolds: z.array(PsdStructuralScaffoldGroupPartSchema).default([]),
  generatedLeafScaffolds: z.array(PsdStructuralScaffoldLeafDrawableSchema).default([]),
  issues: z.array(PsdStructuralScaffoldIssueSchema).default([]),
  preflightPolicy: z.object({
    approvedLeafLimit: z.literal(PSD_STRUCTURAL_APPROVED_LEAF_LIMIT),
    approvedGroupLimit: z.literal(PSD_STRUCTURAL_APPROVED_GROUP_LIMIT),
    generatedNodeLimit: z.literal(PSD_STRUCTURAL_GENERATED_NODE_LIMIT),
    totalRawRgbaByteLimit: z.literal(PSD_STRUCTURAL_TOTAL_RAW_RGBA_BYTE_LIMIT),
    mutationPolicy: z.literal("preflightBlocksOnAnyFailure"),
    silentPartialSuccess: z.literal("forbidden")
  }).strict(),
  persistenceBoundary: z.object({
    rawParserObjectPersistence: z.literal("notPersisted"),
    sourcePsdBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    materializedLayerBytePersistence: z.literal("binaryAssetRefOnlyNoInlineBytes"),
    photoshopCompositingClaim: z.literal("none"),
    rendererPixelOracleClaim: z.literal("none"),
    initialGridMeshGeneration: z.literal("notProvided"),
    semanticRecognition: z.literal("notProvided"),
    repoProposalGeneration: z.literal("notProvided")
  }).strict()
}).strict();
type PsdStructuralScaffoldOperationEvidenceDto = z.infer<
  typeof PsdStructuralScaffoldOperationEvidenceSchema
>;
type StructuralSourcePsdIdentity = NonNullable<
  PsdStructuralScaffoldOperationEvidenceDto["structuralScaffoldBridge"]
>["approval"]["sourcePsd"];

export interface PsdStructuralScaffoldDiagnosticsInput {
  readonly packageDocument: PackageDocumentDto;
  readonly structuralEvidence?: readonly unknown[];
  readonly requireStructuralEvidence?: boolean;
}

interface PartWithIndex {
  readonly part: ModelPartDto;
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

interface SourceAssetWithIndex {
  readonly sourceAsset: SourceAssetDto;
  readonly index: number;
}

interface StructuralIndexes {
  readonly packageDocument: PackageDocumentDto;
  readonly sourceAssetsById: ReadonlyMap<string, SourceAssetWithIndex>;
  readonly partsById: ReadonlyMap<string, PartWithIndex>;
  readonly drawablesById: ReadonlyMap<string, DrawableWithIndex>;
  readonly meshesById: ReadonlyMap<string, MeshWithIndex>;
  readonly texturesById: ReadonlyMap<string, TextureWithIndex>;
}

interface StructuralValidationContext {
  readonly packageDocument: PackageDocumentDto;
  readonly indexes: StructuralIndexes;
  readonly evidence: PsdStructuralScaffoldOperationEvidenceDto;
  readonly evidenceIndex: number;
}

interface StructuralGroupContext extends StructuralValidationContext {
  readonly group: PsdStructuralScaffoldGroupPartDto;
  readonly groupIndex: number;
  readonly sourceAsset: SourceAssetDto | undefined;
  readonly sourceAssetIndex: number | undefined;
}

interface StructuralLeafContext extends StructuralValidationContext {
  readonly leaf: PsdStructuralScaffoldLeafDrawableDto;
  readonly leafIndex: number;
  readonly sourceAsset: SourceAssetDto | undefined;
  readonly sourceAssetIndex: number | undefined;
}

interface ReportedStructuralIssueMapping {
  readonly checkId: string;
  readonly status: CheckStatus;
  readonly severity: Severity;
  readonly phase: "source_import" | "rights" | "reference";
  readonly impact: string;
}

const REPORTED_STRUCTURAL_ISSUE_MAPPINGS: Readonly<Record<
  PsdStructuralScaffoldIssueKindDto,
  ReportedStructuralIssueMapping
>> = {
  stalePlan: {
    checkId: "asset.psd.structuralScaffoldPlanStale",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight cannot trust structural scaffold evidence when the source plan is stale."
  },
  staleApproval: {
    checkId: "asset.psd.structuralScaffoldApprovalMismatch",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight cannot trust structural scaffold evidence when approval evidence is stale."
  },
  missingCandidate: {
    checkId: "asset.psd.structuralScaffoldSourceLayerMappingMissing",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight cannot verify a structural leaf that is absent from parser-free source evidence."
  },
  blockedCandidate: {
    checkId: "asset.psd.structuralScaffoldPreflightBlocked",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight must block structural scaffold evidence that operation evidence reports as blocked."
  },
  notApproved: {
    checkId: "asset.psd.structuralScaffoldApprovalMismatch",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Only explicit structural approval may be passed to the structural scaffold operation."
  },
  collision: {
    checkId: "asset.psd.structuralScaffoldGeneratedRefCollision",
    status: "fail",
    severity: "error",
    phase: "reference",
    impact:
      "Product Preflight must not treat collision-blocked structural evidence as generated output."
  },
  destinationParent: {
    checkId: "asset.psd.structuralScaffoldParentageMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    impact:
      "Structural scaffold evidence cannot be trusted without valid generated parent parts."
  },
  sourceIdentityMismatch: {
    checkId: "asset.psd.structuralScaffoldSourceStale",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight cannot trust structural scaffold evidence when source identity mismatches."
  },
  byteUnavailable: {
    checkId: "asset.psd.structuralScaffoldByteUnavailable",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    impact:
      "Product Preflight must report structural materialization as not evaluated until bytes are supplied."
  },
  byteCapExceeded: {
    checkId: "asset.psd.structuralScaffoldPreflightBlocked",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight must not treat byte-cap-blocked structural evidence as generated output."
  },
  partialFailure: {
    checkId: "asset.psd.structuralScaffoldPartialState",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight must block structural scaffold evidence that mixes generated and failed state."
  },
  unsupportedCandidate: {
    checkId: "asset.psd.structuralScaffoldPreflightBlocked",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight must block unsupported structural source candidates from materialization."
  },
  hiddenCandidate: {
    checkId: "asset.psd.structuralScaffoldPreflightBlocked",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Hidden source leaves are valid only through Wave50 structural hidden-runtime evidence, not legacy hidden blockers."
  },
  emptyCandidate: {
    checkId: "asset.psd.structuralScaffoldPreflightBlocked",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight must block empty structural leaf candidates from materialization."
  },
  currentSessionSourceMissing: {
    checkId: "asset.psd.structuralScaffoldSourceCurrentBytesMissing",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    impact:
      "Product Preflight must report current-session source bytes as not evaluated until they are supplied."
  },
  privateLocalProvenanceFailure: {
    checkId: "asset.psd.structuralScaffoldProvenanceBlocked",
    status: "fail",
    severity: "blocking",
    phase: "rights",
    impact:
      "Product Preflight must not treat structural scaffold evidence as usable without private/local provenance."
  },
  initialRuntimeVisibilityMismatch: {
    checkId: "asset.psd.structuralInitialRuntimeVisibilityMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    impact:
      "Hidden PSD leaves must become runtime-hidden drawables and visible leaves must keep their initial runtime visibility."
  },
  structuralExpansionCapExceeded: {
    checkId: "asset.psd.structuralScaffoldPreflightBlocked",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight must not treat cap-blocked structural scaffold evidence as generated output."
  },
  sourceGroupMappingMissing: {
    checkId: "asset.psd.structuralScaffoldSourceGroupMappingMissing",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight cannot verify generated part containers without matching source group metadata."
  },
  sourceLayerMappingMissing: {
    checkId: "asset.psd.structuralScaffoldSourceLayerMappingMissing",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight cannot verify generated leaf scaffolds without matching source layer metadata."
  },
  structuralParentageMismatch: {
    checkId: "asset.psd.structuralScaffoldParentageMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    impact:
      "Product Preflight cannot verify PSD hierarchy copy evidence while generated parentage disagrees."
  },
  structuralSourceOrderMismatch: {
    checkId: "asset.psd.structuralScaffoldSourceOrderMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    impact:
      "Product Preflight cannot verify deterministic PSD hierarchy copy evidence while generated order disagrees."
  },
  structuralGeneratedRefCollision: {
    checkId: "asset.psd.structuralScaffoldGeneratedRefCollision",
    status: "fail",
    severity: "error",
    phase: "reference",
    impact:
      "Product Preflight cannot verify structural scaffold evidence while generated refs collide."
  },
  structuralPlanStale: {
    checkId: "asset.psd.structuralScaffoldPlanStale",
    status: "fail",
    severity: "error",
    phase: "source_import",
    impact:
      "Product Preflight cannot trust structural scaffold evidence when the structural plan is stale."
  },
  structuralByteUnavailable: {
    checkId: "asset.psd.structuralScaffoldByteUnavailable",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    impact:
      "Product Preflight must report structural materialization as not evaluated until bytes are supplied."
  }
};

export const validatePsdStructuralScaffoldDiagnostics = (
  input: PsdStructuralScaffoldDiagnosticsInput
): readonly ValidationCheckResultDto[] => {
  const evidence = input.structuralEvidence ?? [];
  if (evidence.length === 0) {
    return input.requireStructuralEvidence === true ||
      hasPsdStructuralPlanOrApprovalEvidence(input.packageDocument)
      ? [createStructuralEvidenceMissingCheck(input.packageDocument)]
      : [];
  }

  const indexes = createStructuralIndexes(input.packageDocument);
  return evidence.flatMap((candidate, evidenceIndex) => {
    const rawChecks = [
      ...createForbiddenGroupClaimChecks({
        packageDocument: input.packageDocument,
        evidenceIndex,
        candidate
      }),
      ...createRawVisibilityMismatchChecks({
        packageDocument: input.packageDocument,
        evidenceIndex,
        candidate
      })
    ];
    const parsed = PsdStructuralScaffoldOperationEvidenceSchema.safeParse(candidate);

    if (!parsed.success) {
      return [
        createStructuralEvidenceMismatchCheck({
          packageDocument: input.packageDocument,
          evidenceIndex,
          issues: parsed.error.issues.map((issue) =>
            `${issue.path.join(".") || "<root>"}:${issue.message}`
          )
        }),
        ...rawChecks
      ];
    }

    return [
      ...rawChecks,
      ...validateStructuralOperationEvidence({
        packageDocument: input.packageDocument,
        indexes,
        evidence: parsed.data,
        evidenceIndex
      })
    ];
  });
};

const createStructuralIndexes = (packageDocument: PackageDocumentDto): StructuralIndexes => ({
  packageDocument,
  sourceAssetsById: new Map(
    packageDocument.assets.sourceManifest.sourceAssets.map((sourceAsset, index) => [
      sourceAsset.sourceAssetId,
      { sourceAsset, index }
    ])
  ),
  partsById: new Map(
    packageDocument.model.graph.parts.map((part, index) => [
      part.partId,
      { part, index }
    ])
  ),
  drawablesById: new Map(
    packageDocument.model.drawables.drawables.map((drawable, index) => [
      drawable.drawableId,
      { drawable, index }
    ])
  ),
  meshesById: new Map(
    packageDocument.model.meshes.meshes.map((mesh, index) => [
      mesh.meshId,
      { mesh, index }
    ])
  ),
  texturesById: new Map(
    packageDocument.assets.textureAtlas?.textures.map((texture, index) => [
      texture.textureId,
      { texture, index }
    ]) ?? []
  )
});

const validateStructuralOperationEvidence = (
  context: StructuralValidationContext
): readonly ValidationCheckResultDto[] => {
  const sourceAssetEntry = context.indexes.sourceAssetsById.get(context.evidence.sourceAssetId);
  const sourceAsset = sourceAssetEntry?.sourceAsset;
  const checks: ValidationCheckResultDto[] = [
    ...validateAggregateStatus(context),
    ...validateStructuralBridge(context, sourceAsset, sourceAssetEntry?.index),
    ...validateDuplicateGeneratedRefs(context)
  ];

  context.evidence.issues.forEach((issue, issueIndex) => {
    checks.push(createReportedStructuralIssueCheck({
      context,
      issue,
      issueIndex,
      source: "operation",
      targetPath:
        issue.targetPath ??
        `${createEvidenceTargetPath(context.evidenceIndex)}/issues/${issueIndex}`
    }));
  });

  context.evidence.generatedGroupPartScaffolds.forEach((group, groupIndex) => {
    checks.push(...validateGroupScaffold({
      ...context,
      group,
      groupIndex,
      sourceAsset,
      sourceAssetIndex: sourceAssetEntry?.index
    }));
  });

  context.evidence.generatedLeafScaffolds.forEach((leaf, leafIndex) => {
    checks.push(...validateLeafScaffold({
      ...context,
      leaf,
      leafIndex,
      sourceAsset,
      sourceAssetIndex: sourceAssetEntry?.index
    }));
  });

  checks.push(...validateGroupOrder(context));
  checks.push(...validateLeafOrder(context));

  const hasFailureOrNotEvaluated = checks.some((check) =>
    check.status === "fail" || check.status === "needs_review"
  );
  if (!hasFailureOrNotEvaluated && context.evidence.aggregateStatus === "success") {
    checks.push(createStructuralAvailableCheck(context));
  }

  return checks;
};

const validateAggregateStatus = (
  context: StructuralValidationContext
): readonly ValidationCheckResultDto[] => {
  if (context.evidence.aggregateStatus === "success") {
    return [];
  }

  return [
    createStructuralCheck({
      context,
      checkId: context.evidence.aggregateStatus === "preflightBlocked"
        ? "asset.psd.structuralScaffoldPreflightBlocked"
        : "asset.psd.structuralScaffoldPartialState",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: createEvidenceTargetPath(context.evidenceIndex),
      message:
        `PSD structural scaffold evidence ${context.evidence.batchId} reports aggregate status ` +
        `${context.evidence.aggregateStatus}.`,
      evidence: [
        `aggregateStatus=${context.evidence.aggregateStatus}`,
        `operationIssueKinds=${formatIssueKinds(context.evidence.issues)}`,
        `generatedGroupPartCount=${context.evidence.generatedGroupPartScaffolds.length}`,
        `generatedLeafScaffoldCount=${context.evidence.generatedLeafScaffolds.length}`,
        "mutationPolicy=preflightBlocksOnAnyFailure",
        "silentPartialSuccess=forbidden"
      ],
      impact:
        "Product Preflight cannot treat structural scaffold operation evidence as available when the operation was blocked or failed."
    })
  ];
};

const validateStructuralBridge = (
  context: StructuralValidationContext,
  sourceAsset: SourceAssetDto | undefined,
  sourceAssetIndex: number | undefined
): readonly ValidationCheckResultDto[] => {
  const bridge = context.evidence.structuralScaffoldBridge;
  if (bridge === undefined) {
    return [
      createStructuralCheck({
        context,
        checkId: "asset.psd.structuralScaffoldEvidenceMissing",
        status: "needs_review",
        severity: "warning",
        phase: "source_import",
        targetPath: `${createEvidenceTargetPath(context.evidenceIndex)}/structuralScaffoldBridge`,
        message:
          `PSD structural scaffold evidence ${context.evidence.batchId} has no structural plan/approval bridge evidence.`,
        evidence: [
          "structuralBridgeAvailability=not_evaluated",
          "requiredEvidence=psdStructuralScaffoldApprovalBridgeEvidence"
        ],
        impact:
          "Product Preflight cannot verify structural source parentage, approval, or stale source identity without bridge evidence."
      })
    ];
  }

  const checks: ValidationCheckResultDto[] = [];
  const plan = bridge.structuralPlan;
  const approval = bridge.approval;

  plan.issues.forEach((issue, issueIndex) => {
    checks.push(createReportedStructuralIssueCheck({
      context,
      issue,
      issueIndex,
      source: "plan",
      targetPath:
        issue.targetPath ??
        `${createEvidenceTargetPath(context.evidenceIndex)}/structuralScaffoldBridge/structuralPlan/issues/${issueIndex}`
    }));
  });
  approval.issues.forEach((issue, issueIndex) => {
    checks.push(createReportedStructuralIssueCheck({
      context,
      issue,
      issueIndex,
      source: "approval",
      targetPath:
        issue.targetPath ??
        `${createEvidenceTargetPath(context.evidenceIndex)}/structuralScaffoldBridge/approval/issues/${issueIndex}`
    }));
  });

  if (!sameDigest(plan.structuralPlanDigest, approval.structuralPlanDigest)) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldApprovalMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath:
        `${createEvidenceTargetPath(context.evidenceIndex)}/structuralScaffoldBridge/approval/structuralPlanDigest`,
      message:
        `Structural scaffold approval ${approval.approvalId} does not match plan ${plan.structuralPlanId}.`,
      evidence: [
        `structuralPlanId=${plan.structuralPlanId}`,
        `planDigest=${formatDigest(plan.structuralPlanDigest)}`,
        `approvalId=${approval.approvalId}`,
        `approvalPlanDigest=${formatDigest(approval.structuralPlanDigest)}`,
        "reason=approval-plan-digest-mismatch"
      ],
      impact:
        "Product Preflight cannot trust structural operation evidence when approval is bound to a different plan digest."
    }));
  }

  if (!sameSourcePsdIdentity(plan.sourcePsd, approval.sourcePsd)) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldSourceStale",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath:
        `${createEvidenceTargetPath(context.evidenceIndex)}/structuralScaffoldBridge/sourcePsd`,
      message:
        `Structural scaffold plan ${plan.structuralPlanId} and approval ${approval.approvalId} source PSD identities disagree.`,
      evidence: [
        `planSourceAssetId=${plan.sourcePsd.sourceAssetId}`,
        `approvalSourceAssetId=${approval.sourcePsd.sourceAssetId}`,
        `planDigest=${formatDigest(plan.sourcePsd.digest)}`,
        `approvalDigest=${formatDigest(approval.sourcePsd.digest)}`,
        `planByteLength=${plan.sourcePsd.byteLength}`,
        `approvalByteLength=${approval.sourcePsd.byteLength}`,
        "reason=plan-approval-source-identity-mismatch"
      ],
      impact:
        "Product Preflight cannot trust structural source parentage or generated refs while source identity is stale."
    }));
  }

  if (approval.approvalStatus !== "approved") {
    checks.push(createStructuralCheck({
      context,
      checkId: approval.approvalStatus === "structuralExpansionCapExceeded"
        ? "asset.psd.structuralScaffoldPreflightBlocked"
        : "asset.psd.structuralScaffoldApprovalMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath:
        `${createEvidenceTargetPath(context.evidenceIndex)}/structuralScaffoldBridge/approval/approvalStatus`,
      message:
        `Structural scaffold approval ${approval.approvalId} has status ${approval.approvalStatus}.`,
      evidence: [
        `approvalId=${approval.approvalId}`,
        `approvalStatus=${approval.approvalStatus}`,
        `approvalIssueKinds=${formatIssueKinds(approval.issues)}`
      ],
      impact:
        "Product Preflight cannot treat structural scaffold output as available unless approval evidence is approved."
    }));
  }

  checks.push(...validateCurrentSourceIdentity({
    context,
    sourceAsset,
    sourceAssetIndex,
    sourcePsd: approval.sourcePsd
  }));
  checks.push(...validateStoredStructuralEvidence({
    context,
    profile: sourceAsset?.psdProfile
  }));

  return checks;
};

const validateCurrentSourceIdentity = (input: {
  readonly context: StructuralValidationContext;
  readonly sourceAsset: SourceAssetDto | undefined;
  readonly sourceAssetIndex: number | undefined;
  readonly sourcePsd: StructuralSourcePsdIdentity;
}): readonly ValidationCheckResultDto[] => {
  if (input.sourceAsset === undefined) {
    return [
      createStructuralCheck({
        context: input.context,
        checkId: "asset.psd.structuralScaffoldSourceStale",
        status: "fail",
        severity: "error",
        phase: "source_import",
        targetPath: createEvidenceTargetPath(input.context.evidenceIndex),
        message:
          `PSD structural scaffold evidence references missing source asset ${input.context.evidence.sourceAssetId}.`,
        evidence: [
          `sourceAssetId=${input.context.evidence.sourceAssetId}`,
          "sourceAssetMatch=missing"
        ],
        impact:
          "Product Preflight cannot verify structural scaffold evidence without the referenced source asset."
      })
    ];
  }

  const checks: ValidationCheckResultDto[] = [];
  const sourceAssetPath = `/assets/sourceManifest/sourceAssets/${input.sourceAssetIndex ?? "unknown"}`;
  if (input.sourceAsset.binaryAssetRef === undefined) {
    checks.push(createStructuralCheck({
      context: input.context,
      checkId: "asset.psd.structuralScaffoldSourceCurrentBytesMissing",
      status: "needs_review",
      severity: "warning",
      phase: "source_import",
      targetPath: `${sourceAssetPath}/binaryAssetRef`,
      message:
        `PSD source asset ${input.sourceAsset.sourceAssetId} has no current binary asset ref for structural scaffold revalidation.`,
      evidence: [
        `sourceAssetId=${input.sourceAsset.sourceAssetId}`,
        "sourceBinaryAssetRef=missing",
        "structuralSourceIdentityAvailability=needs_review",
        "sourcePsdBytePersistence=metadataOnlyNoRawBytes"
      ],
      impact:
        "Product Preflight must report structural source materialization as not evaluated until current-session PSD bytes are available."
    }));
    return checks;
  }

  const mismatchReasons = [
    ...(input.sourcePsd.sourceAssetId === input.sourceAsset.sourceAssetId
      ? []
      : ["source-asset-id-mismatch"]),
    ...(sameDigest(input.sourcePsd.digest, input.sourceAsset.binaryAssetRef.digest)
      ? []
      : ["source-digest-mismatch"]),
    ...(input.sourcePsd.byteLength === input.sourceAsset.binaryAssetRef.byteLength
      ? []
      : ["source-byte-length-mismatch"])
  ];
  if (mismatchReasons.length > 0) {
    checks.push(createStructuralCheck({
      context: input.context,
      checkId: "asset.psd.structuralScaffoldSourceStale",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${sourceAssetPath}/binaryAssetRef`,
      message:
        `PSD structural scaffold source identity is stale for source asset ${input.sourceAsset.sourceAssetId}.`,
      evidence: [
        `sourceAssetId=${input.sourceAsset.sourceAssetId}`,
        `evidenceDigest=${formatDigest(input.sourcePsd.digest)}`,
        `currentDigest=${formatDigest(input.sourceAsset.binaryAssetRef.digest)}`,
        `evidenceByteLength=${input.sourcePsd.byteLength}`,
        `currentByteLength=${input.sourceAsset.binaryAssetRef.byteLength}`,
        `reasons=${mismatchReasons.join(",")}`
      ],
      impact:
        "Product Preflight cannot trust structural scaffold evidence derived from a stale PSD source identity."
    }));
  }

  return checks;
};

const validateStoredStructuralEvidence = (input: {
  readonly context: StructuralValidationContext;
  readonly profile: LayeredCharacterPsdProfileDto | undefined;
}): readonly ValidationCheckResultDto[] => {
  const bridge = input.context.evidence.structuralScaffoldBridge;
  if (bridge === undefined || input.profile === undefined) {
    return [];
  }

  const checks: ValidationCheckResultDto[] = [];
  const plan = bridge.structuralPlan;
  const approval = bridge.approval;

  if (
    input.profile.psdStructuralScaffoldPlanEvidence !== undefined &&
    !input.profile.psdStructuralScaffoldPlanEvidence.some((storedPlan) =>
      storedPlan.structuralPlanId === plan.structuralPlanId &&
      sameDigest(storedPlan.structuralPlanDigest, plan.structuralPlanDigest)
    )
  ) {
    checks.push(createStructuralCheck({
      context: input.context,
      checkId: "asset.psd.structuralScaffoldPlanStale",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath:
        `${createEvidenceTargetPath(input.context.evidenceIndex)}/structuralScaffoldBridge/structuralPlan`,
      message:
        `Structural scaffold plan ${plan.structuralPlanId} is absent from stored PSD source profile plan evidence.`,
      evidence: [
        `structuralPlanId=${plan.structuralPlanId}`,
        `structuralPlanDigest=${formatDigest(plan.structuralPlanDigest)}`,
        `storedPlanEvidenceCount=${input.profile.psdStructuralScaffoldPlanEvidence.length}`,
        "reason=stored-structural-plan-evidence-missing"
      ],
      impact:
        "Product Preflight cannot trust operation evidence when stored source profile plan evidence disagrees."
    }));
  }

  if (
    input.profile.psdStructuralScaffoldApprovalEvidence !== undefined &&
    !input.profile.psdStructuralScaffoldApprovalEvidence.some((storedApproval) =>
      storedApproval.approvalId === approval.approvalId &&
      sameDigest(storedApproval.structuralPlanDigest, approval.structuralPlanDigest) &&
      sameDigest(storedApproval.approvalSelectionDigest, approval.approvalSelectionDigest)
    )
  ) {
    checks.push(createStructuralCheck({
      context: input.context,
      checkId: "asset.psd.structuralScaffoldApprovalMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath:
        `${createEvidenceTargetPath(input.context.evidenceIndex)}/structuralScaffoldBridge/approval`,
      message:
        `Structural scaffold approval ${approval.approvalId} is absent from stored PSD source profile approval evidence.`,
      evidence: [
        `approvalId=${approval.approvalId}`,
        `structuralPlanDigest=${formatDigest(approval.structuralPlanDigest)}`,
        `approvalSelectionDigest=${formatDigest(approval.approvalSelectionDigest)}`,
        `storedApprovalEvidenceCount=${input.profile.psdStructuralScaffoldApprovalEvidence.length}`,
        "reason=stored-structural-approval-evidence-missing"
      ],
      impact:
        "Product Preflight cannot trust operation evidence when stored source profile approval evidence disagrees."
    }));
  }

  return checks;
};

const validateGroupScaffold = (
  context: StructuralGroupContext
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const groupPath = createGroupTargetPath(context);
  const sourceGroup = findPsdProfileSourceGroup(context.sourceAsset, context.group.sourceGroupRef.sourceGroupId);
  const generatedPart = context.indexes.partsById.get(context.group.generatedPartId);
  const generatedParentPart = context.indexes.partsById.get(context.group.generatedParentPartId);

  if (sourceGroup === undefined) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldSourceGroupMappingMissing",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${groupPath}/sourceGroupRef`,
      message:
        `Structural group scaffold ${context.group.sourceGroupRef.sourceGroupId} has no matching PSD source group metadata.`,
      evidence: [
        ...createGroupEvidence(context.group),
        `sourceAssetId=${context.sourceAsset?.sourceAssetId ?? context.evidence.sourceAssetId}`,
        "sourceGroupMatch=missing"
      ],
      impact:
        "Product Preflight cannot verify a generated part container without source group mapping evidence."
    }));
  } else {
    checks.push(...validateGroupSourceMapping(context, sourceGroup, groupPath));
  }

  if (generatedPart === undefined) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldGeneratedPartMissing",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `${groupPath}/generatedPartId`,
      targetKind: "part",
      targetId: context.group.generatedPartId,
      message:
        `Structural group scaffold ${context.group.sourceGroupRef.sourceGroupId} generated part ${context.group.generatedPartId} is missing.`,
      evidence: [
        ...createGroupEvidence(context.group),
        "generatedPartMatch=missing"
      ],
      impact:
        "PSD group scaffold evidence cannot be used until the generated project part container exists."
    }));
  }

  if (generatedParentPart === undefined) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldGeneratedParentMissing",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `${groupPath}/generatedParentPartId`,
      targetKind: "part",
      targetId: context.group.generatedParentPartId,
      message:
        `Structural group scaffold ${context.group.sourceGroupRef.sourceGroupId} generated parent part ${context.group.generatedParentPartId} is missing.`,
      evidence: [
        ...createGroupEvidence(context.group),
        "generatedParentPartMatch=missing"
      ],
      impact:
        "PSD group scaffold evidence cannot prove hierarchy parentage until the generated parent part exists."
    }));
  }

  if (generatedPart !== undefined && generatedParentPart !== undefined) {
    checks.push(...validateGeneratedGroupParentage(context, generatedPart, generatedParentPart, groupPath));
  }

  return checks;
};

const validateGroupSourceMapping = (
  context: StructuralGroupContext,
  sourceGroup: PsdProfileSourceGroupDto,
  groupPath: string
): readonly ValidationCheckResultDto[] => {
  const mismatches = [
    ...(sourceGroup.sourceOrder === context.group.sourceOrder
      ? []
      : [`sourceOrder:expected=${sourceGroup.sourceOrder},actual=${context.group.sourceOrder}`]),
    ...(sameOptionalString(sourceGroup.parentGroupId, context.group.sourceParentGroupRef?.sourceGroupId)
      ? []
      : [
          `parentGroupId:expected=${sourceGroup.parentGroupId ?? "missing"},actual=${
            context.group.sourceParentGroupRef?.sourceGroupId ?? "missing"
          }`
        ]),
    ...(sourceGroup.visibleInSource === context.group.visibleInSource
      ? []
      : [`visibleInSource:expected=${sourceGroup.visibleInSource},actual=${context.group.visibleInSource}`]),
    ...(sourceGroup.opacityInSource === context.group.opacityInSource
      ? []
      : [`opacityInSource:expected=${sourceGroup.opacityInSource},actual=${context.group.opacityInSource}`]),
    ...(sameStringArray(sourceGroup.groupPath, context.group.sourceGroupPath)
      ? []
      : [`sourceGroupPath:expected=${sourceGroup.groupPath.join("/")},actual=${context.group.sourceGroupPath.join("/")}`])
  ];

  if (mismatches.length === 0) {
    return [];
  }

  return [
    createStructuralCheck({
      context,
      checkId: mismatches.some((mismatch) => mismatch.startsWith("sourceOrder"))
        ? "asset.psd.structuralScaffoldSourceOrderMismatch"
        : "asset.psd.structuralScaffoldParentageMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${groupPath}/sourceGroupRef`,
      message:
        `Structural group scaffold ${context.group.sourceGroupRef.sourceGroupId} no longer matches PSD source group metadata.`,
      evidence: [
        ...createGroupEvidence(context.group),
        `sourceGroupProfileOrder=${sourceGroup.sourceOrder}`,
        `sourceGroupProfileParentGroupId=${sourceGroup.parentGroupId ?? "missing"}`,
        `mismatches=${mismatches.join(",")}`
      ],
      impact:
        "Product Preflight cannot verify deterministic PSD group hierarchy copying while source group evidence disagrees."
    })
  ];
};

const validateGeneratedGroupParentage = (
  context: StructuralGroupContext,
  generatedPart: PartWithIndex,
  generatedParentPart: PartWithIndex,
  groupPath: string
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const expectedGeneratedParentPartId = expectedGroupGeneratedParentPartId(
    context.evidence,
    context.group
  );
  const mismatches = [
    ...(generatedPart.part.parentPartId === context.group.generatedParentPartId
      ? []
      : [
          `partParentPartId:expected=${context.group.generatedParentPartId},actual=${
            generatedPart.part.parentPartId ?? "missing"
          }`
        ]),
    ...(generatedParentPart.part.childPartIds.includes(context.group.generatedPartId)
      ? []
      : ["parentChildList=missing"]),
    ...(expectedGeneratedParentPartId === context.group.generatedParentPartId
      ? []
      : [
          `sourceParentGeneratedPartId:expected=${expectedGeneratedParentPartId},actual=${context.group.generatedParentPartId}`
        ])
  ];

  if (mismatches.length > 0) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldParentageMismatch",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `/model/graph/parts/${generatedPart.index}`,
      targetKind: "part",
      targetId: context.group.generatedPartId,
      message:
        `Structural group scaffold ${context.group.sourceGroupRef.sourceGroupId} generated part parentage is inconsistent.`,
      evidence: [
        ...createGroupEvidence(context.group),
        `actualPartParentId=${generatedPart.part.parentPartId ?? "missing"}`,
        `parentChildPartIds=${generatedParentPart.part.childPartIds.join(",")}`,
        `mismatches=${mismatches.join(",")}`
      ],
      impact:
        "Product Preflight cannot verify PSD group hierarchy copying while generated part parentage disagrees."
    }));
  }

  return checks;
};

const validateLeafScaffold = (
  context: StructuralLeafContext
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const leafPath = createLeafTargetPath(context);
  const flattenedLayer = findFlattenedSourceLayer(context.sourceAsset, context.leaf.sourceLayerRef.sourceLayerId);
  const profileLayer = findPsdProfileSourceLayer(context.sourceAsset, context.leaf.sourceLayerRef.sourceLayerId);
  const generatedParentPart = context.indexes.partsById.get(context.leaf.generatedParentPartId);
  const drawable = context.indexes.drawablesById.get(context.leaf.generatedDrawableId);
  const mesh = context.indexes.meshesById.get(context.leaf.generatedMeshId);
  const texture = context.indexes.texturesById.get(context.leaf.generatedTextureId);

  if (flattenedLayer === undefined && profileLayer === undefined) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldSourceLayerMappingMissing",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${leafPath}/sourceLayerRef`,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} has no matching PSD source layer metadata.`,
      evidence: [
        ...createLeafEvidence(context.leaf),
        `sourceAssetId=${context.sourceAsset?.sourceAssetId ?? context.evidence.sourceAssetId}`,
        "sourceLayerMatch=missing"
      ],
      impact:
        "Product Preflight cannot verify a generated drawable scaffold without source layer mapping evidence."
    }));
  } else {
    checks.push(...validateLeafSourceMapping(context, flattenedLayer, profileLayer, leafPath));
  }

  if (generatedParentPart === undefined) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldGeneratedParentMissing",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `${leafPath}/generatedParentPartId`,
      targetKind: "part",
      targetId: context.leaf.generatedParentPartId,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} generated parent part ${context.leaf.generatedParentPartId} is missing.`,
      evidence: [
        ...createLeafEvidence(context.leaf),
        "generatedParentPartMatch=missing"
      ],
      impact:
        "PSD leaf scaffold evidence cannot prove generated hierarchy parentage until the parent part exists."
    }));
  }
  checks.push(...validateLeafGeneratedParentage(context, leafPath));

  if (drawable === undefined) {
    checks.push(createGeneratedTargetMissingCheck({
      context,
      checkId: "asset.psd.structuralScaffoldGeneratedDrawableMissing",
      targetKind: "drawable",
      targetId: context.leaf.generatedDrawableId,
      targetPath: `${leafPath}/generatedDrawableId`,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} generated drawable ${context.leaf.generatedDrawableId} is missing.`
    }));
  }

  if (mesh === undefined) {
    checks.push(createGeneratedTargetMissingCheck({
      context,
      checkId: "asset.psd.structuralScaffoldGeneratedMeshMissing",
      targetKind: "mesh",
      targetId: context.leaf.generatedMeshId,
      targetPath: `${leafPath}/generatedMeshId`,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} generated mesh ${context.leaf.generatedMeshId} is missing.`
    }));
  }

  if (texture === undefined) {
    checks.push(createGeneratedTargetMissingCheck({
      context,
      checkId: "asset.psd.structuralScaffoldGeneratedTextureMissing",
      targetKind: "texture",
      targetId: context.leaf.generatedTextureId,
      targetPath: `${leafPath}/generatedTextureId`,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} generated texture ${context.leaf.generatedTextureId} is missing.`
    }));
  }

  if (drawable !== undefined) {
    checks.push(...validateGeneratedDrawable(context, drawable, generatedParentPart, leafPath));
  }
  if (mesh !== undefined) {
    checks.push(...validateGeneratedMesh(context, mesh, leafPath));
  }
  if (texture !== undefined) {
    checks.push(...validateGeneratedTexture(context, texture, leafPath));
  }

  return checks;
};

const validateLeafGeneratedParentage = (
  context: StructuralLeafContext,
  leafPath: string
): readonly ValidationCheckResultDto[] => {
  const expectedGeneratedParentPartId = expectedLeafGeneratedParentPartId(
    context.evidence,
    context.leaf
  );
  if (expectedGeneratedParentPartId === context.leaf.generatedParentPartId) {
    return [];
  }

  return [
    createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldParentageMismatch",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `${leafPath}/generatedParentPartId`,
      targetKind: "part",
      targetId: context.leaf.generatedParentPartId,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} generated parent part does not match PSD source parentage.`,
      evidence: [
        ...createLeafEvidence(context.leaf),
        `sourceParentGeneratedPartId:expected=${expectedGeneratedParentPartId ?? "missing"},actual=${context.leaf.generatedParentPartId}`,
        expectedGeneratedParentPartId === undefined
          ? "sourceParentGroupGeneratedPartMatch=missing"
          : "sourceParentGroupGeneratedPartMatch=matched"
      ],
      impact:
        "Product Preflight cannot verify PSD leaf hierarchy copying while generated parentage disagrees with source group hierarchy."
    })
  ];
};

const validateLeafSourceMapping = (
  context: StructuralLeafContext,
  flattenedLayer: SourceLayerDto | undefined,
  profileLayer: PsdProfileSourceLayerDto | undefined,
  leafPath: string
): readonly ValidationCheckResultDto[] => {
  const sourceOrder = profileLayer?.sourceOrder;
  const visibleInSource = profileLayer?.visibleInSource ?? flattenedLayer?.visibleInSource;
  const opacityInSource = profileLayer?.opacityInSource ?? flattenedLayer?.opacityInSource;
  const bounds = profileLayer?.bounds ?? flattenedLayer?.bounds;
  const parentGroupId = profileLayer?.parentGroupId;
  const groupPath = profileLayer?.groupPath ?? flattenedLayer?.groupPath;
  const mappedDrawableIds = flattenedLayer?.mappedDrawableIds ?? [];
  const mismatches = [
    ...(sourceOrder === undefined || sourceOrder === context.leaf.sourceOrder
      ? []
      : [`sourceOrder:expected=${sourceOrder},actual=${context.leaf.sourceOrder}`]),
    ...(visibleInSource === undefined || visibleInSource === context.leaf.visibleInSource
      ? []
      : [`visibleInSource:expected=${visibleInSource},actual=${context.leaf.visibleInSource}`]),
    ...(opacityInSource === undefined || opacityInSource === context.leaf.opacityInSource
      ? []
      : [`opacityInSource:expected=${opacityInSource},actual=${context.leaf.opacityInSource}`]),
    ...(bounds === undefined || sameRect(bounds, context.leaf.bounds)
      ? []
      : [`bounds:expected=${formatRect(bounds)},actual=${formatRect(context.leaf.bounds)}`]),
    ...(parentGroupId === undefined || parentGroupId === context.leaf.sourceParentGroupRef?.sourceGroupId
      ? []
      : [
          `parentGroupId:expected=${parentGroupId},actual=${
            context.leaf.sourceParentGroupRef?.sourceGroupId ?? "missing"
          }`
        ]),
    ...(groupPath === undefined || sameStringArray(groupPath, context.leaf.sourceLayerPath.slice(0, -1))
      ? []
      : [
          `groupPath:expected=${groupPath.join("/")},actual=${
            context.leaf.sourceLayerPath.slice(0, -1).join("/")
          }`
        ])
  ];

  const checks: ValidationCheckResultDto[] = [];
  if (mismatches.length > 0) {
    checks.push(createStructuralCheck({
      context,
      checkId: mismatches.some((mismatch) => mismatch.startsWith("sourceOrder"))
        ? "asset.psd.structuralScaffoldSourceOrderMismatch"
        : "asset.psd.structuralScaffoldSourceLayerMappingMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${leafPath}/sourceLayerRef`,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} no longer matches PSD source layer metadata.`,
      evidence: [
        ...createLeafEvidence(context.leaf),
        `mismatches=${mismatches.join(",")}`
      ],
      impact:
        "Product Preflight cannot verify deterministic PSD leaf copying while source layer evidence disagrees."
    }));
  }

  if (
    flattenedLayer !== undefined &&
    !mappedDrawableIds.includes(context.leaf.generatedDrawableId)
  ) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldSourceLayerMappingMissing",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${leafPath}/sourceLayerRef`,
      message:
        `PSD source layer ${flattenedLayer.sourceLayerId} does not map to generated drawable ${context.leaf.generatedDrawableId}.`,
      evidence: [
        ...createLeafEvidence(context.leaf),
        `mappedDrawableIds=${mappedDrawableIds.join(",") || "none"}`,
        "reason=generated-drawable-not-in-source-layer-mapping"
      ],
      impact:
        "Product Preflight cannot trace the generated drawable back through source layer mapping evidence."
    }));
  }

  return checks;
};

const validateGeneratedDrawable = (
  context: StructuralLeafContext,
  drawable: DrawableWithIndex,
  generatedParentPart: PartWithIndex | undefined,
  leafPath: string
): readonly ValidationCheckResultDto[] => {
  const mismatches = [
    ...(drawable.drawable.partId === context.leaf.generatedParentPartId
      ? []
      : [`drawablePartId:expected=${context.leaf.generatedParentPartId},actual=${drawable.drawable.partId}`]),
    ...(drawable.drawable.sourceAssetId === context.evidence.sourceAssetId
      ? []
      : [`drawableSourceAssetId:expected=${context.evidence.sourceAssetId},actual=${drawable.drawable.sourceAssetId}`]),
    ...(drawable.drawable.textureId === context.leaf.generatedTextureId
      ? []
      : [`drawableTextureId:expected=${context.leaf.generatedTextureId},actual=${drawable.drawable.textureId}`]),
    ...(drawable.drawable.meshId === context.leaf.generatedMeshId
      ? []
      : [`drawableMeshId:expected=${context.leaf.generatedMeshId},actual=${drawable.drawable.meshId}`]),
    ...(generatedParentPart === undefined ||
    generatedParentPart.part.drawableIds.includes(context.leaf.generatedDrawableId)
      ? []
      : ["parentDrawableList=missing"])
  ];
  const checks: ValidationCheckResultDto[] = [];

  if (mismatches.length > 0) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldGeneratedRefMismatch",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `/model/drawables/drawables/${drawable.index}`,
      targetKind: "drawable",
      targetId: context.leaf.generatedDrawableId,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} generated drawable refs are inconsistent.`,
      evidence: [
        ...createLeafEvidence(context.leaf),
        `actualDrawablePartId=${drawable.drawable.partId}`,
        `actualDrawableTextureId=${drawable.drawable.textureId}`,
        `actualDrawableMeshId=${drawable.drawable.meshId}`,
        `mismatches=${mismatches.join(",")}`
      ],
      impact:
        "Product Preflight cannot verify generated leaf scaffolds while drawable references disagree with evidence."
    }));
  }

  if (drawable.drawable.runtimeVisibility !== context.leaf.initialRuntimeVisibility) {
    checks.push(createStructuralCheck({
      context,
      checkId: "asset.psd.structuralInitialRuntimeVisibilityMismatch",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `/model/drawables/drawables/${drawable.index}/runtimeVisibility`,
      targetKind: "drawable",
      targetId: context.leaf.generatedDrawableId,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} generated drawable runtime visibility does not match initial PSD visibility.`,
      evidence: [
        ...createLeafEvidence(context.leaf),
        `drawableRuntimeVisibility=${drawable.drawable.runtimeVisibility}`,
        `initialRuntimeVisibility=${context.leaf.initialRuntimeVisibility}`,
        `visibleInSource=${context.leaf.visibleInSource}`,
        `hiddenLeafRuntimeVisibility=${
          context.leaf.visibleInSource ? "not-hidden-source" : drawable.drawable.runtimeVisibility
        }`
      ],
      impact:
        "Hidden PSD leaves must be generated as runtime-hidden drawables, and visible PSD leaves must stay runtime-visible."
    }));
  }

  return checks;
};

const validateGeneratedMesh = (
  context: StructuralLeafContext,
  mesh: MeshWithIndex,
  leafPath: string
): readonly ValidationCheckResultDto[] => {
  if (mesh.mesh.drawableId === context.leaf.generatedDrawableId) {
    return [];
  }

  return [
    createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldGeneratedRefMismatch",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `/model/meshes/meshes/${mesh.index}/drawableId`,
      targetKind: "mesh",
      targetId: context.leaf.generatedMeshId,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} generated mesh references the wrong drawable.`,
      evidence: [
        ...createLeafEvidence(context.leaf),
        `meshDrawableId=${mesh.mesh.drawableId}`,
        `expectedDrawableId=${context.leaf.generatedDrawableId}`,
        `leafEvidencePath=${leafPath}`
      ],
      impact:
        "Product Preflight cannot verify generated leaf scaffold mesh evidence while mesh drawable ownership disagrees."
    })
  ];
};

const validateGeneratedTexture = (
  context: StructuralLeafContext,
  texture: TextureWithIndex,
  leafPath: string
): readonly ValidationCheckResultDto[] => {
  const mismatches = [
    ...(texture.texture.sourceAssetId === undefined ||
    texture.texture.sourceAssetId === context.evidence.sourceAssetId
      ? []
      : [`textureSourceAssetId:expected=${context.evidence.sourceAssetId},actual=${texture.texture.sourceAssetId}`]),
    ...(texture.texture.sourceLayerId === undefined ||
    texture.texture.sourceLayerId === context.leaf.sourceLayerRef.sourceLayerId
      ? []
      : [
          `textureSourceLayerId:expected=${context.leaf.sourceLayerRef.sourceLayerId},actual=${texture.texture.sourceLayerId}`
        ])
  ];

  if (mismatches.length === 0) {
    return [];
  }

  return [
    createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldSourceLayerMappingMismatch",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `/assets/textureAtlas/textures/${texture.index}`,
      targetKind: "texture",
      targetId: context.leaf.generatedTextureId,
      message:
        `Structural leaf scaffold ${context.leaf.sourceLayerRef.sourceLayerId} generated texture source mapping disagrees.`,
      evidence: [
        ...createLeafEvidence(context.leaf),
        `textureSourceAssetId=${texture.texture.sourceAssetId ?? "missing"}`,
        `textureSourceLayerId=${texture.texture.sourceLayerId ?? "missing"}`,
        `mismatches=${mismatches.join(",")}`,
        `leafEvidencePath=${leafPath}`
      ],
      impact:
        "Product Preflight cannot trace generated texture evidence back to the same PSD source layer."
    })
  ];
};

const createGeneratedTargetMissingCheck = (input: {
  readonly context: StructuralLeafContext;
  readonly checkId: string;
  readonly targetKind: "drawable" | "mesh" | "texture";
  readonly targetId: string;
  readonly targetPath: string;
  readonly message: string;
}): ValidationCheckResultDto =>
  createStructuralCheck({
    context: input.context,
    checkId: input.checkId,
    status: "fail",
    severity: "error",
    phase: "reference",
    targetPath: input.targetPath,
    targetKind: input.targetKind,
    targetId: input.targetId,
    message: input.message,
    evidence: [
      ...createLeafEvidence(input.context.leaf),
      `${input.targetKind}Match=missing`
    ],
    impact:
      "PSD leaf scaffold evidence cannot be accepted until every generated drawable, texture, and mesh ref resolves."
  });

const validateDuplicateGeneratedRefs = (
  context: StructuralValidationContext
): readonly ValidationCheckResultDto[] => {
  const generatedPartIds = context.evidence.generatedGroupPartScaffolds.map((group) =>
    group.generatedPartId
  );
  const generatedDrawableIds = context.evidence.generatedLeafScaffolds.map((leaf) =>
    leaf.generatedDrawableId
  );
  const generatedMeshIds = context.evidence.generatedLeafScaffolds.map((leaf) =>
    leaf.generatedMeshId
  );
  const generatedTextureIds = context.evidence.generatedLeafScaffolds.map((leaf) =>
    leaf.generatedTextureId
  );
  const duplicateRefs = [
    ...findDuplicateValues(generatedPartIds).map((id) => `part:${id}`),
    ...findDuplicateValues(generatedDrawableIds).map((id) => `drawable:${id}`),
    ...findDuplicateValues(generatedMeshIds).map((id) => `mesh:${id}`),
    ...findDuplicateValues(generatedTextureIds).map((id) => `texture:${id}`)
  ];

  if (duplicateRefs.length === 0) {
    return [];
  }

  return [
    createStructuralCheck({
      context,
      checkId: "asset.psd.structuralScaffoldGeneratedRefCollision",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: createEvidenceTargetPath(context.evidenceIndex),
      message:
        `PSD structural scaffold evidence ${context.evidence.batchId} contains duplicate generated refs.`,
      evidence: [
        `duplicateGeneratedRefs=${duplicateRefs.join(",")}`,
        "reason=duplicate-generated-ref-in-evidence"
      ],
      impact:
        "Product Preflight cannot verify deterministic generated hierarchy while structural evidence reuses generated refs."
    })
  ];
};

const validateGroupOrder = (
  context: StructuralValidationContext
): readonly ValidationCheckResultDto[] =>
  validateGeneratedOrder({
    context,
    nodes: context.evidence.generatedGroupPartScaffolds,
    getParentId: (group) => group.generatedParentPartId,
    getGeneratedId: (group) => group.generatedPartId,
    getSourceOrder: (group) => group.sourceOrder,
    getOrderList: (part) => part.childPartIds,
    nodeLabel: "group",
    checkTargetPath: (parent) => `/model/graph/parts/${parent.index}/childPartIds`,
    createEvidence: (left, right) => [
      `leftSourceGroupId=${left.sourceGroupRef.sourceGroupId}`,
      `rightSourceGroupId=${right.sourceGroupRef.sourceGroupId}`
    ]
  });

const validateLeafOrder = (
  context: StructuralValidationContext
): readonly ValidationCheckResultDto[] =>
  validateGeneratedOrder({
    context,
    nodes: context.evidence.generatedLeafScaffolds,
    getParentId: (leaf) => leaf.generatedParentPartId,
    getGeneratedId: (leaf) => leaf.generatedDrawableId,
    getSourceOrder: (leaf) => leaf.sourceOrder,
    getOrderList: (part) => part.drawableIds,
    nodeLabel: "leaf",
    checkTargetPath: (parent) => `/model/graph/parts/${parent.index}/drawableIds`,
    createEvidence: (left, right) => [
      `leftSourceLayerId=${left.sourceLayerRef.sourceLayerId}`,
      `rightSourceLayerId=${right.sourceLayerRef.sourceLayerId}`
    ]
  });

const validateGeneratedOrder = <TNode>(input: {
  readonly context: StructuralValidationContext;
  readonly nodes: readonly TNode[];
  readonly getParentId: (node: TNode) => string;
  readonly getGeneratedId: (node: TNode) => string;
  readonly getSourceOrder: (node: TNode) => number;
  readonly getOrderList: (part: ModelPartDto) => readonly string[];
  readonly nodeLabel: string;
  readonly checkTargetPath: (parent: PartWithIndex) => string;
  readonly createEvidence: (left: TNode, right: TNode) => readonly string[];
}): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const nodesByParentId = new Map<string, TNode[]>();
  for (const node of input.nodes) {
    const parentId = input.getParentId(node);
    nodesByParentId.set(parentId, [...(nodesByParentId.get(parentId) ?? []), node]);
  }

  for (const [parentPartId, nodes] of nodesByParentId) {
    const parent = input.context.indexes.partsById.get(parentPartId);
    if (parent === undefined || nodes.length < 2) {
      continue;
    }

    const sortedNodes = [...nodes].sort((left, right) =>
      input.getSourceOrder(left) - input.getSourceOrder(right)
    );
    const orderList = input.getOrderList(parent.part);
    for (let index = 1; index < sortedNodes.length; index += 1) {
      const left = sortedNodes[index - 1]!;
      const right = sortedNodes[index]!;
      const leftPosition = orderList.indexOf(input.getGeneratedId(left));
      const rightPosition = orderList.indexOf(input.getGeneratedId(right));
      if (leftPosition < 0 || rightPosition < 0 || leftPosition <= rightPosition) {
        continue;
      }

      checks.push(createStructuralCheck({
        context: input.context,
        checkId: "asset.psd.structuralScaffoldSourceOrderMismatch",
        status: "fail",
        severity: "error",
        phase: "reference",
        targetPath: input.checkTargetPath(parent),
        targetKind: "part",
        targetId: parentPartId,
        message:
          `PSD structural ${input.nodeLabel} generated order under part ${parentPartId} does not follow sourceOrder.`,
        evidence: [
          `parentPartId=${parentPartId}`,
          `leftGeneratedId=${input.getGeneratedId(left)}`,
          `rightGeneratedId=${input.getGeneratedId(right)}`,
          `leftSourceOrder=${input.getSourceOrder(left)}`,
          `rightSourceOrder=${input.getSourceOrder(right)}`,
          `leftGeneratedPosition=${leftPosition}`,
          `rightGeneratedPosition=${rightPosition}`,
          ...input.createEvidence(left, right),
          "reason=generated-order-disagrees-with-source-order"
        ],
        impact:
          "Product Preflight cannot verify deterministic PSD source order preservation while generated order disagrees."
      }));
      break;
    }
  }

  return checks;
};

const createReportedStructuralIssueCheck = (input: {
  readonly context: StructuralValidationContext;
  readonly issue: PsdStructuralScaffoldIssueDto;
  readonly issueIndex: number;
  readonly source: "operation" | "plan" | "approval";
  readonly targetPath: string;
}): ValidationCheckResultDto => {
  const mapping = REPORTED_STRUCTURAL_ISSUE_MAPPINGS[input.issue.issueKind];

  return createStructuralCheck({
    context: input.context,
    checkId: mapping.checkId,
    status: mapping.status,
    severity: mapping.severity,
    phase: mapping.phase,
    targetPath: input.targetPath,
    targetKind: input.issue.sourceLayerRef !== undefined
      ? "sourceAsset"
      : input.issue.sourceGroupRef !== undefined
        ? "sourceAsset"
        : "sourceAsset",
    targetId:
      input.issue.sourceLayerRef?.sourceAssetId ??
      input.issue.sourceGroupRef?.sourceAssetId ??
      input.context.evidence.sourceAssetId,
    message:
      `PSD structural scaffold ${input.source} issue ${input.issue.issueKind}: ${input.issue.message}`,
    evidence: [
      `structuralIssueSource=${input.source}`,
      `structuralIssueIndex=${input.issueIndex}`,
      `structuralIssueKind=${input.issue.issueKind}`,
      `structuralIssueCheckId=${input.issue.checkId ?? "missing"}`,
      `structuralIssueId=${input.issue.issueId ?? "missing"}`,
      ...(input.issue.sourceGroupRef === undefined ? [] : [
        `sourceGroupId=${input.issue.sourceGroupRef.sourceGroupId}`
      ]),
      ...(input.issue.sourceLayerRef === undefined ? [] : [
        `sourceLayerId=${input.issue.sourceLayerRef.sourceLayerId}`
      ])
    ],
    impact: mapping.impact
  });
};

const createStructuralAvailableCheck = (
  context: StructuralValidationContext
): ValidationCheckResultDto =>
  createStructuralCheck({
    context,
    checkId: "asset.psd.structuralScaffoldAvailable",
    status: "pass",
    severity: "info",
    phase: "source_import",
    targetPath: createEvidenceTargetPath(context.evidenceIndex),
    message:
      `PSD structural scaffold evidence ${context.evidence.batchId} has generated group hierarchy and leaf scaffold evidence available.`,
    evidence: [
      `structuralScaffoldAvailability=available`,
      `generatedGroupPartCount=${context.evidence.generatedGroupPartScaffolds.length}`,
      `generatedLeafScaffoldCount=${context.evidence.generatedLeafScaffolds.length}`,
      `hiddenLeafCount=${context.evidence.generatedLeafScaffolds.filter((leaf) => !leaf.visibleInSource).length}`,
      `runtimeHiddenDrawableCount=${
        context.evidence.generatedLeafScaffolds.filter((leaf) => !leaf.initialRuntimeVisibility).length
      }`,
      "groupsAsPartContainersOnly=true",
      "groupDrawableTextureMeshRefs=forbidden",
      "hiddenLeafRuntimeVisibility=validated",
      "sourceOrderPreservation=validated",
      "structuralEvidence=parser-free-session-evidence",
      "productPreflightPersistence=sessionOnly"
    ],
    impact:
      "Product Preflight can treat this explicit structural scaffold operation as available hierarchy and materialization evidence without parser execution, semantic recognition, renderer proof, or pixel oracle claims."
  });

const createStructuralEvidenceMissingCheck = (
  packageDocument: PackageDocumentDto
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "asset.psd.structuralScaffoldEvidenceMissing",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    target: {
      kind: "package",
      id: packageDocument.manifest.packageId
    },
    targetPath: "/session/psdStructuralScaffoldEvidence",
    message:
      "PSD structural scaffold plan or approval evidence is present, but no session structural operation evidence was supplied for Product Preflight.",
    evidence: [
      "structuralScaffoldEvidenceAvailability=not_evaluated",
      "requiredEvidence=psdStructuralScaffoldEvidence",
      "validatorBoundary=no-parser-execution",
      "rawParserObject=notPersisted",
      "sourcePsdBytes=notPersisted",
      "productPreflightPersistence=sessionOnly"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003", "SC-PART-001", "SC-MVP-004"],
    impact:
      "Product Preflight must report structural scaffold validation as not evaluated until operation evidence is supplied."
  });

const createStructuralEvidenceMismatchCheck = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly evidenceIndex: number;
  readonly issues: readonly string[];
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "asset.psd.structuralScaffoldEvidenceMismatch",
    status: "fail",
    severity: "error",
    phase: "source_import",
    target: {
      kind: "package",
      id: input.packageDocument.manifest.packageId,
      path: createEvidenceTargetPath(input.evidenceIndex)
    },
    targetPath: createEvidenceTargetPath(input.evidenceIndex),
    message:
      `PSD structural scaffold evidence ${input.evidenceIndex} does not match the Wave50 parser-free evidence schema.`,
    evidence: [
      `structuralEvidenceIndex=${input.evidenceIndex}`,
      `schemaIssues=${input.issues.join("|")}`,
      "validatorBoundary=no-parser-execution",
      "rawParserObject=notPersisted",
      "sourcePsdBytes=notPersisted",
      "productPreflightPersistence=sessionOnly"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003", "SC-PART-001", "SC-MVP-004"],
    impact:
      "Product Preflight cannot trust malformed structural scaffold evidence or infer missing parser/runtime details."
  });

const createForbiddenGroupClaimChecks = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly evidenceIndex: number;
  readonly candidate: unknown;
}): readonly ValidationCheckResultDto[] => {
  const groupEntries = collectRawGroupObjects(input.candidate, input.evidenceIndex);
  return groupEntries.flatMap((entry) => {
    const forbiddenKeys = [
      "generatedDrawableId",
      "generatedTextureId",
      "generatedMeshId",
      "drawableId",
      "textureId",
      "meshId"
    ].filter((key) => Object.prototype.hasOwnProperty.call(entry.value, key));

    if (forbiddenKeys.length === 0) {
      return [];
    }

    return [
      ValidationCheckResultSchema.parse({
        checkId: "asset.psd.structuralGroupForbiddenDrawableClaim",
        status: "fail",
        severity: "error",
        phase: "source_import",
        target: {
          kind: "package",
          id: input.packageDocument.manifest.packageId,
          path: entry.path
        },
        targetPath: entry.path,
        message:
          `PSD structural group scaffold at ${entry.path} contains forbidden drawable, texture, or mesh refs.`,
        evidence: [
          `structuralEvidenceIndex=${input.evidenceIndex}`,
          `forbiddenGroupKeys=${forbiddenKeys.join(",")}`,
          "groupsAsPartContainersOnly=true",
          "groupDrawableTextureMeshRefs=forbidden",
          "groupAsArtMesh=notProvided"
        ],
        relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
        relatedScenarios: ["SC-IN-003", "SC-PART-001", "SC-MVP-004"],
        impact:
          "PSD groups may only scaffold project part containers; Product Preflight must reject evidence that claims group drawable, texture, or mesh output."
      })
    ];
  });
};

const createRawVisibilityMismatchChecks = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly evidenceIndex: number;
  readonly candidate: unknown;
}): readonly ValidationCheckResultDto[] => {
  const leafEntries = collectRawLeafObjects(input.candidate, input.evidenceIndex);
  return leafEntries.flatMap((entry) => {
    const visibleInSource = getObjectBoolean(entry.value, "visibleInSource");
    const initialRuntimeVisibility = getObjectBoolean(entry.value, "initialRuntimeVisibility");
    if (
      visibleInSource === undefined ||
      initialRuntimeVisibility === undefined ||
      visibleInSource === initialRuntimeVisibility
    ) {
      return [];
    }

    return [
      ValidationCheckResultSchema.parse({
        checkId: "asset.psd.structuralInitialRuntimeVisibilityMismatch",
        status: "fail",
        severity: "error",
        phase: "source_import",
        target: {
          kind: "package",
          id: input.packageDocument.manifest.packageId,
          path: entry.path
        },
        targetPath: entry.path,
        message:
          `PSD structural leaf scaffold at ${entry.path} has initial runtime visibility that does not match source visibility.`,
        evidence: [
          `structuralEvidenceIndex=${input.evidenceIndex}`,
          `visibleInSource=${visibleInSource}`,
          `initialRuntimeVisibility=${initialRuntimeVisibility}`,
          "reason=evidence-initial-runtime-visibility-mismatch"
        ],
        relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
        relatedScenarios: ["SC-IN-003", "SC-PART-001", "SC-MVP-004"],
        impact:
          "Hidden PSD leaves must be represented as initially runtime-hidden drawables, and visible leaves as runtime-visible drawables."
      })
    ];
  });
};

const createStructuralCheck = (input: {
  readonly context: StructuralValidationContext;
  readonly checkId: string;
  readonly status: CheckStatus;
  readonly severity: Severity;
  readonly phase: "source_import" | "rights" | "reference";
  readonly targetPath: string;
  readonly targetKind?: "package" | "sourceAsset" | "part" | "drawable" | "mesh" | "texture";
  readonly targetId?: string;
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
      kind: input.targetKind ?? "sourceAsset",
      id: input.targetId ?? input.context.evidence.sourceAssetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: [
      ...createCommonStructuralEvidence(input.context),
      ...input.evidence,
      ...createBoundaryEvidence()
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003", "SC-PART-001", "SC-MVP-004"],
    impact: input.impact
  });

const createCommonStructuralEvidence = (
  context: StructuralValidationContext
): readonly string[] => [
  `structuralEvidenceId=${context.evidence.evidenceId ?? "missing"}`,
  `structuralOperationId=${context.evidence.operationId ?? "missing"}`,
  `structuralBatchId=${context.evidence.batchId}`,
  `structuralEvidenceIndex=${context.evidenceIndex}`,
  `sourceAssetId=${context.evidence.sourceAssetId}`,
  `destinationParentPartId=${context.evidence.destination.parentPartId}`,
  `aggregateStatus=${context.evidence.aggregateStatus}`,
  `operationIssueKinds=${formatIssueKinds(context.evidence.issues)}`
];

const createBoundaryEvidence = (): readonly string[] => [
  "validatorBoundary=no-parser-execution",
  "rawParserObject=notPersisted",
  "sourcePsdBytes=notPersisted",
  "rawMaterializedBytes=notInlined",
  "photoshopCompositing=notClaimed",
  "rendererPixelOracle=notClaimed",
  "semanticRecognition=notProvided",
  "repoProposalGeneration=notProvided",
  "initialGridMeshGeneration=notProvided",
  "groupAsArtMesh=notProvided",
  "productPreflightPersistence=sessionOnly"
];

const createGroupEvidence = (
  group: PsdStructuralScaffoldGroupPartDto
): readonly string[] => [
  `sourceGroupId=${group.sourceGroupRef.sourceGroupId}`,
  `sourceParentGroupId=${group.sourceParentGroupRef?.sourceGroupId ?? "missing"}`,
  `sourceOrder=${group.sourceOrder}`,
  `sourceGroupPath=${group.sourceGroupPath.join("/") || "root"}`,
  `generatedParentPartId=${group.generatedParentPartId}`,
  `generatedPartId=${group.generatedPartId}`,
  `groupStatus=${group.status}`,
  "scaffoldKind=groupPartContainer"
];

const createLeafEvidence = (
  leaf: PsdStructuralScaffoldLeafDrawableDto
): readonly string[] => [
  `sourceLayerId=${leaf.sourceLayerRef.sourceLayerId}`,
  `sourceParentGroupId=${leaf.sourceParentGroupRef?.sourceGroupId ?? "missing"}`,
  `sourceOrder=${leaf.sourceOrder}`,
  `sourceLayerPath=${leaf.sourceLayerPath.join("/") || leaf.sourceLayerRef.sourceLayerId}`,
  `visibleInSource=${leaf.visibleInSource}`,
  `initialRuntimeVisibility=${leaf.initialRuntimeVisibility}`,
  `generatedParentPartId=${leaf.generatedParentPartId}`,
  `generatedDrawableId=${leaf.generatedDrawableId}`,
  `generatedMeshId=${leaf.generatedMeshId}`,
  `generatedTextureId=${leaf.generatedTextureId}`,
  `leafStatus=${leaf.status}`,
  "scaffoldKind=leafDrawableScaffold"
];

const hasPsdStructuralPlanOrApprovalEvidence = (
  packageDocument: PackageDocumentDto
): boolean =>
  packageDocument.assets.sourceManifest.sourceAssets.some((sourceAsset) =>
    (sourceAsset.psdProfile?.psdStructuralScaffoldPlanEvidence?.length ?? 0) > 0 ||
    (sourceAsset.psdProfile?.psdStructuralScaffoldApprovalEvidence?.length ?? 0) > 0
  );

const findPsdProfileSourceGroup = (
  sourceAsset: SourceAssetDto | undefined,
  sourceGroupId: string
): PsdProfileSourceGroupDto | undefined =>
  sourceAsset?.psdProfile?.sourceGroups.find((group) => group.sourceGroupId === sourceGroupId);

const findPsdProfileSourceLayer = (
  sourceAsset: SourceAssetDto | undefined,
  sourceLayerId: string
): PsdProfileSourceLayerDto | undefined =>
  sourceAsset?.psdProfile?.sourceLayers.find((layer) => layer.sourceLayerId === sourceLayerId);

const findFlattenedSourceLayer = (
  sourceAsset: SourceAssetDto | undefined,
  sourceLayerId: string
): SourceLayerDto | undefined =>
  sourceAsset?.layers.find((layer) => layer.sourceLayerId === sourceLayerId);

const expectedGroupGeneratedParentPartId = (
  evidence: PsdStructuralScaffoldOperationEvidenceDto,
  group: PsdStructuralScaffoldGroupPartDto
): string => {
  const parentSourceGroupId = group.sourceParentGroupRef?.sourceGroupId;
  if (parentSourceGroupId === undefined) {
    return evidence.destination.parentPartId;
  }

  return evidence.generatedGroupPartScaffolds.find((candidate) =>
    candidate.sourceGroupRef.sourceGroupId === parentSourceGroupId
  )?.generatedPartId ?? group.generatedParentPartId;
};

const expectedLeafGeneratedParentPartId = (
  evidence: PsdStructuralScaffoldOperationEvidenceDto,
  leaf: PsdStructuralScaffoldLeafDrawableDto
): string | undefined => {
  const parentSourceGroupId = leaf.sourceParentGroupRef?.sourceGroupId;
  if (parentSourceGroupId === undefined) {
    return evidence.destination.parentPartId;
  }

  return evidence.generatedGroupPartScaffolds.find((candidate) =>
    candidate.sourceGroupRef.sourceGroupId === parentSourceGroupId
  )?.generatedPartId;
};

const createEvidenceTargetPath = (evidenceIndex: number): string =>
  `/session/psdStructuralScaffoldEvidence/${evidenceIndex}`;

const createGroupTargetPath = (context: StructuralGroupContext): string =>
  `${createEvidenceTargetPath(context.evidenceIndex)}/generatedGroupPartScaffolds/${context.groupIndex}`;

const createLeafTargetPath = (context: StructuralLeafContext): string =>
  `${createEvidenceTargetPath(context.evidenceIndex)}/generatedLeafScaffolds/${context.leafIndex}`;

const collectRawGroupObjects = (
  value: unknown,
  evidenceIndex: number
): readonly { readonly path: string; readonly value: Record<string, unknown> }[] => [
  ...collectRawObjectsAtPath(
    value,
    ["generatedGroupPartScaffolds"],
    createEvidenceTargetPathToken(evidenceIndex, "generatedGroupPartScaffolds")
  ),
  ...collectRawObjectsAtPath(
    value,
    ["structuralScaffoldBridge", "structuralPlan", "plannedGroupPartScaffolds"],
    createEvidenceTargetPathToken(
      evidenceIndex,
      "structuralScaffoldBridge/structuralPlan/plannedGroupPartScaffolds"
    )
  ),
  ...collectRawObjectsAtPath(
    value,
    ["structuralScaffoldBridge", "approval", "approvedGroupPartScaffolds"],
    createEvidenceTargetPathToken(
      evidenceIndex,
      "structuralScaffoldBridge/approval/approvedGroupPartScaffolds"
    )
  )
].filter((entry) => entry.value.scaffoldKind === "groupPartContainer");

const collectRawLeafObjects = (
  value: unknown,
  evidenceIndex: number
): readonly { readonly path: string; readonly value: Record<string, unknown> }[] => [
  ...collectRawObjectsAtPath(
    value,
    ["generatedLeafScaffolds"],
    createEvidenceTargetPathToken(evidenceIndex, "generatedLeafScaffolds")
  ),
  ...collectRawObjectsAtPath(
    value,
    ["structuralScaffoldBridge", "structuralPlan", "plannedLeafScaffolds"],
    createEvidenceTargetPathToken(
      evidenceIndex,
      "structuralScaffoldBridge/structuralPlan/plannedLeafScaffolds"
    )
  ),
  ...collectRawObjectsAtPath(
    value,
    ["structuralScaffoldBridge", "approval", "approvedLeafScaffolds"],
    createEvidenceTargetPathToken(
      evidenceIndex,
      "structuralScaffoldBridge/approval/approvedLeafScaffolds"
    )
  )
].filter((entry) => entry.value.scaffoldKind === "leafDrawableScaffold");

const createEvidenceTargetPathToken = (
  evidenceIndex: number,
  path: string
): string => `/session/psdStructuralScaffoldEvidence/${evidenceIndex}/${path}`;

const collectRawObjectsAtPath = (
  value: unknown,
  segments: readonly string[],
  pathPrefix: string
): readonly { readonly path: string; readonly value: Record<string, unknown> }[] => {
  const target = getNestedValue(value, segments);
  if (!Array.isArray(target)) {
    return [];
  }

  return target.flatMap((entry, index) =>
    isRecord(entry)
      ? [{ path: `${pathPrefix}/${index}`, value: entry }]
      : []
  );
};

const getNestedValue = (
  value: unknown,
  segments: readonly string[]
): unknown => {
  let current = value;
  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }

  return current;
};

const getObjectBoolean = (
  value: Record<string, unknown>,
  key: string
): boolean | undefined =>
  typeof value[key] === "boolean" ? value[key] : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formatIssueKinds = (
  issues: readonly PsdStructuralScaffoldIssueDto[]
): string =>
  issues.map((issue) => issue.issueKind).join(",") || "none";

const findDuplicateValues = (
  values: readonly string[]
): readonly string[] => {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
};

const sameDigest = (
  left: { readonly algorithm: string; readonly hex: string } | undefined,
  right: { readonly algorithm: string; readonly hex: string } | undefined
): boolean =>
  left !== undefined &&
  right !== undefined &&
  left.algorithm === right.algorithm &&
  left.hex === right.hex;

const sameSourcePsdIdentity = (
  left: {
    readonly sourceAssetId: string;
    readonly byteLength: number;
    readonly digest: { readonly algorithm: string; readonly hex: string };
    readonly sourceBytePersistence: string;
    readonly publicDemoAsset: boolean;
  },
  right: {
    readonly sourceAssetId: string;
    readonly byteLength: number;
    readonly digest: { readonly algorithm: string; readonly hex: string };
    readonly sourceBytePersistence: string;
    readonly publicDemoAsset: boolean;
  }
): boolean =>
  left.sourceAssetId === right.sourceAssetId &&
  left.byteLength === right.byteLength &&
  sameDigest(left.digest, right.digest) &&
  left.sourceBytePersistence === right.sourceBytePersistence &&
  left.publicDemoAsset === right.publicDemoAsset;

const formatDigest = (
  digest: { readonly algorithm: string; readonly hex: string } | undefined
): string =>
  digest === undefined ? "missing" : `${digest.algorithm}:${digest.hex}`;

const sameRect = (
  left: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  right: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
): boolean =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;

const formatRect = (
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
): string => `${rect.x},${rect.y},${rect.width},${rect.height}`;

const sameStringArray = (
  left: readonly string[],
  right: readonly string[]
): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const sameOptionalString = (
  left: string | undefined,
  right: string | undefined
): boolean =>
  left === right;
