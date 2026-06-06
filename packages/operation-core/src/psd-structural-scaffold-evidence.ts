import {
  DrawableIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  PartIdSchema,
  RectSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import {
  PsdImportPlanByteLengthSchema,
  PsdImportPlanDigestSchema,
  PsdImportPlanIssueKindSchema,
  PsdImportPlanParserEvidenceSchema,
  PsdImportPlanSourceLayerReferenceSchema,
  PsdImportPlanSourcePsdIdentitySchema
} from "./psd-import-plan-approval-evidence.js";

const PSD_STRUCTURAL_PLAN_ID_PATTERN = /^plan_[A-Za-z0-9_-]+$/;
const PSD_STRUCTURAL_APPROVAL_ID_PATTERN = /^approval_[A-Za-z0-9_-]+$/;
const PSD_STRUCTURAL_EVIDENCE_ID_PATTERN = /^evidence_[A-Za-z0-9_-]+$/;
const PSD_STRUCTURAL_BATCH_ID_PATTERN = /^batch_[A-Za-z0-9_-]+$/;

export const PSD_STRUCTURAL_APPROVED_LEAF_LIMIT = 6;
export const PSD_STRUCTURAL_APPROVED_GROUP_LIMIT = 32;
export const PSD_STRUCTURAL_GENERATED_NODE_LIMIT = 64;
export const PSD_STRUCTURAL_TOTAL_RAW_RGBA_BYTE_LIMIT = 32 * 1024 * 1024;

export const PsdStructuralScaffoldSourceNodeRefSchema = z.object({
  kind: z.enum(["document", "group", "layer"]),
  id: z.string().min(1).optional(),
  path: z.string().min(1).optional()
}).strict();
export type PsdStructuralScaffoldSourceNodeRefDto = z.infer<
  typeof PsdStructuralScaffoldSourceNodeRefSchema
>;

export const PsdStructuralScaffoldSourceGroupReferenceSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  sourceGroupId: z.string().min(1),
  sourceGroupName: z.string().min(1).optional(),
  sourceGroupPath: z.array(z.string().min(1)).optional()
}).strict();
export type PsdStructuralScaffoldSourceGroupReferenceDto = z.infer<
  typeof PsdStructuralScaffoldSourceGroupReferenceSchema
>;

export const PsdStructuralScaffoldScopeSchema = z.object({
  scopeRef: PsdStructuralScaffoldSourceNodeRefSchema,
  scopeDisplayPath: z.array(z.string().min(1)).default([]),
  discoveryMode: z.literal("explicitStructuralScaffoldPreview")
}).strict();
export type PsdStructuralScaffoldScopeDto = z.infer<
  typeof PsdStructuralScaffoldScopeSchema
>;

export const PsdStructuralScaffoldNodeStatusSchema = z.enum([
  "previewReady",
  "approved",
  "resolved",
  "blocked",
  "sourceMappingMissing",
  "parentageInvalid",
  "orderInvalid",
  "generatedIdCollision",
  "generatedNameCollision",
  "byteUnavailable",
  "capExceeded",
  "stale"
]);
export type PsdStructuralScaffoldNodeStatusDto = z.infer<
  typeof PsdStructuralScaffoldNodeStatusSchema
>;

export const PsdStructuralScaffoldGroupPartSchema = z.object({
  scaffoldKind: z.literal("groupPartContainer"),
  sourceGroupRef: PsdStructuralScaffoldSourceGroupReferenceSchema,
  sourceParentGroupRef: PsdStructuralScaffoldSourceGroupReferenceSchema.optional(),
  sourceGroupName: z.string().min(1).optional(),
  sourceGroupPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative(),
  visibleInSource: z.boolean(),
  opacityInSource: z.number().min(0).max(1),
  bounds: RectSchema.optional(),
  generatedParentPartId: PartIdSchema,
  generatedPartId: PartIdSchema,
  generatedPartDisplayName: z.string().min(1),
  status: PsdStructuralScaffoldNodeStatusSchema,
  statusReasons: z.array(z.string().min(1)).default([])
}).strict();
export type PsdStructuralScaffoldGroupPartDto = z.infer<
  typeof PsdStructuralScaffoldGroupPartSchema
>;

export const PsdStructuralScaffoldLeafDrawableSchema = z.object({
  scaffoldKind: z.literal("leafDrawableScaffold"),
  sourceLayerRef: PsdImportPlanSourceLayerReferenceSchema,
  sourceParentGroupRef: PsdStructuralScaffoldSourceGroupReferenceSchema.optional(),
  sourceLayerName: z.string().min(1).optional(),
  sourceLayerPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative(),
  visibleInSource: z.boolean(),
  opacityInSource: z.number().min(0).max(1),
  bounds: RectSchema,
  byteEstimate: PsdImportPlanByteLengthSchema.optional(),
  generatedParentPartId: PartIdSchema,
  generatedDrawableId: DrawableIdSchema,
  generatedDrawableDisplayName: z.string().min(1),
  generatedTextureId: TextureIdSchema,
  generatedMeshId: MeshIdSchema,
  initialRuntimeVisibility: z.boolean(),
  status: PsdStructuralScaffoldNodeStatusSchema,
  statusReasons: z.array(z.string().min(1)).default([])
}).strict().superRefine((leaf, context) => {
  if (leaf.initialRuntimeVisibility !== leaf.visibleInSource) {
    context.addIssue({
      code: "custom",
      path: ["initialRuntimeVisibility"],
      message: "Initial runtime visibility must match the source PSD leaf visibility."
    });
  }
});
export type PsdStructuralScaffoldLeafDrawableDto = z.infer<
  typeof PsdStructuralScaffoldLeafDrawableSchema
>;

export const PsdStructuralScaffoldIssueKindSchema = z.union([
  PsdImportPlanIssueKindSchema,
  z.enum([
    "initialRuntimeVisibilityMismatch",
    "structuralExpansionCapExceeded",
    "sourceGroupMappingMissing",
    "sourceLayerMappingMissing",
    "structuralParentageMismatch",
    "structuralSourceOrderMismatch",
    "structuralGeneratedRefCollision",
    "structuralPlanStale",
    "structuralByteUnavailable"
  ])
]);
export type PsdStructuralScaffoldIssueKindDto = z.infer<
  typeof PsdStructuralScaffoldIssueKindSchema
>;

export const PsdStructuralScaffoldIssueSchema = z.object({
  issueId: z.string().regex(/^issue_[A-Za-z0-9_-]+$/).optional(),
  issueKind: PsdStructuralScaffoldIssueKindSchema,
  checkId: z.string().min(1).optional(),
  message: z.string().min(1),
  targetPath: z.string().min(1).optional(),
  sourceGroupRef: PsdStructuralScaffoldSourceGroupReferenceSchema.optional(),
  sourceLayerRef: PsdImportPlanSourceLayerReferenceSchema.optional(),
  sourceOrder: z.number().int().nonnegative().optional()
}).strict();
export type PsdStructuralScaffoldIssueDto = z.infer<
  typeof PsdStructuralScaffoldIssueSchema
>;

export const PsdStructuralScaffoldCapPolicySchema = z.object({
  structuralNodeLimit: z.number().int().positive(),
  structuralDepthLimit: z.number().int().positive(),
  approvedGroupLimit: z.number().int().positive(),
  approvedLeafLimit: z.number().int().positive(),
  generatedNodeLimit: z.number().int().positive(),
  totalRawRgbaByteLimit: PsdImportPlanByteLengthSchema
}).strict();
export type PsdStructuralScaffoldCapPolicyDto = z.infer<
  typeof PsdStructuralScaffoldCapPolicySchema
>;

export const PsdStructuralScaffoldSummarySchema = z.object({
  sourceGroupCount: z.number().int().nonnegative(),
  sourceLayerCount: z.number().int().nonnegative(),
  approvedGroupCount: z.number().int().nonnegative(),
  approvedLeafCount: z.number().int().nonnegative(),
  generatedGroupPartCount: z.number().int().nonnegative(),
  generatedDrawableCount: z.number().int().nonnegative(),
  hiddenLeafCount: z.number().int().nonnegative(),
  runtimeHiddenDrawableCount: z.number().int().nonnegative(),
  structuralDepth: z.number().int().nonnegative(),
  totalByteEstimate: PsdImportPlanByteLengthSchema.optional()
}).strict();
export type PsdStructuralScaffoldSummaryDto = z.infer<
  typeof PsdStructuralScaffoldSummarySchema
>;

export const PsdStructuralScaffoldPlanEvidenceSchema = z.object({
  schemaVersion: z.literal("psd-structural-scaffold-plan-evidence-v1"),
  evidenceKind: z.literal("psd-structural-scaffold-plan-evidence-v1"),
  structuralPlanId: z.string().regex(PSD_STRUCTURAL_PLAN_ID_PATTERN),
  structuralPlanDigest: PsdImportPlanDigestSchema,
  sourcePsd: PsdImportPlanSourcePsdIdentitySchema,
  parser: PsdImportPlanParserEvidenceSchema.optional(),
  scope: PsdStructuralScaffoldScopeSchema,
  plannedGroupPartScaffolds: z.array(PsdStructuralScaffoldGroupPartSchema).default([]),
  plannedLeafScaffolds: z.array(PsdStructuralScaffoldLeafDrawableSchema).default([]),
  summary: PsdStructuralScaffoldSummarySchema,
  capPolicy: PsdStructuralScaffoldCapPolicySchema,
  issues: z.array(PsdStructuralScaffoldIssueSchema).default([]),
  boundary: z.object({
    explicitStructuralApprovalRequired: z.literal(true),
    groupsAsPartContainersOnly: z.literal(true),
    groupDrawableTextureMeshRefs: z.literal("forbidden"),
    rawParserObjectPersistence: z.literal("notPersisted"),
    sourcePsdBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    structuralPreviewBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    publicDemoAsset: z.literal(false),
    semanticRecognition: z.literal("notProvided"),
    repoProposalGeneration: z.literal("notProvided"),
    initialGridMeshGeneration: z.literal("notProvided"),
    photoshopCompositingClaim: z.literal("none")
  }).strict()
}).strict();
export type PsdStructuralScaffoldPlanEvidenceDto = z.infer<
  typeof PsdStructuralScaffoldPlanEvidenceSchema
>;

export const PsdStructuralScaffoldApprovalStatusSchema = z.enum([
  "approved",
  "structuralPlanStale",
  "approvalSelectionMismatch",
  "preflightBlocked",
  "structuralExpansionCapExceeded"
]);
export type PsdStructuralScaffoldApprovalStatusDto = z.infer<
  typeof PsdStructuralScaffoldApprovalStatusSchema
>;

export const PsdStructuralScaffoldApprovalEvidenceSchema = z.object({
  schemaVersion: z.literal("psd-structural-scaffold-approval-evidence-v1"),
  evidenceKind: z.literal("psd-structural-scaffold-approval-evidence-v1"),
  approvalId: z.string().regex(PSD_STRUCTURAL_APPROVAL_ID_PATTERN),
  structuralPlanDigest: PsdImportPlanDigestSchema,
  approvalSelectionDigest: PsdImportPlanDigestSchema,
  sourcePsd: PsdImportPlanSourcePsdIdentitySchema,
  destination: z.object({
    destinationKind: z.literal("structuralScaffold"),
    parentPartId: PartIdSchema
  }).strict(),
  approvalStatus: PsdStructuralScaffoldApprovalStatusSchema,
  approvedGroupPartScaffolds: z.array(PsdStructuralScaffoldGroupPartSchema).default([]),
  approvedLeafScaffolds: z.array(PsdStructuralScaffoldLeafDrawableSchema).default([]),
  summary: PsdStructuralScaffoldSummarySchema,
  capPolicy: PsdStructuralScaffoldCapPolicySchema,
  issues: z.array(PsdStructuralScaffoldIssueSchema).default([]),
  boundary: z.object({
    explicitStructuralApproval: z.literal(true),
    groupsAsPartContainersOnly: z.literal(true),
    groupDrawableTextureMeshRefs: z.literal("forbidden"),
    rawParserObjectPersistence: z.literal("notPersisted"),
    sourcePsdBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    materializedLayerBytePersistence: z.literal("binaryAssetRefOnlyNoInlineBytes"),
    publicDemoAsset: z.literal(false),
    semanticRecognition: z.literal("notProvided"),
    repoProposalGeneration: z.literal("notProvided"),
    initialGridMeshGeneration: z.literal("notProvided"),
    photoshopCompositingClaim: z.literal("none")
  }).strict()
}).strict();
export type PsdStructuralScaffoldApprovalEvidenceDto = z.infer<
  typeof PsdStructuralScaffoldApprovalEvidenceSchema
>;

export const PsdStructuralScaffoldApprovalBridgeEvidenceSchema = z.object({
  schemaVersion: z.literal("psd-structural-scaffold-approval-bridge-evidence-v1"),
  structuralPlan: PsdStructuralScaffoldPlanEvidenceSchema,
  approval: PsdStructuralScaffoldApprovalEvidenceSchema
}).strict();
export type PsdStructuralScaffoldApprovalBridgeEvidenceDto = z.infer<
  typeof PsdStructuralScaffoldApprovalBridgeEvidenceSchema
>;

export const PsdStructuralScaffoldOperationAggregateStatusSchema = z.enum([
  "success",
  "preflightBlocked",
  "failure"
]);
export type PsdStructuralScaffoldOperationAggregateStatusDto = z.infer<
  typeof PsdStructuralScaffoldOperationAggregateStatusSchema
>;

export const PsdStructuralScaffoldOperationEvidenceDtoSchema = z.object({
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
  aggregateStatus: PsdStructuralScaffoldOperationAggregateStatusSchema,
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
export type PsdStructuralScaffoldOperationEvidenceDto = z.infer<
  typeof PsdStructuralScaffoldOperationEvidenceDtoSchema
>;
