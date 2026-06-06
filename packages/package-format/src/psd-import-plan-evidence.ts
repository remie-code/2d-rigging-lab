import { z } from "zod";

import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  RectSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

import {
  BinaryAssetByteLengthSchema,
  BinaryAssetDigestSchema,
  BinaryAssetMediaTypeSchema
} from "./binary-asset.js";
import {
  PsdParserEvidenceSchema,
  PsdProfileSourceRefSchema,
  PsdSourceLayerReferenceSchema
} from "./psd-source-evidence.js";

const PSD_IMPORT_PLAN_ID_PATTERN = /^plan_[A-Za-z0-9_-]+$/;
const PSD_IMPORT_PLAN_APPROVAL_ID_PATTERN = /^approval_[A-Za-z0-9_-]+$/;

export const PsdImportPlanCandidateStatusSchema = z.enum([
  "candidate",
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
export type PsdImportPlanCandidateStatusDto = z.infer<
  typeof PsdImportPlanCandidateStatusSchema
>;

export const PsdImportPlanSourcePsdIdentitySchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  sourceFilePath: z.string().min(1).optional(),
  digest: BinaryAssetDigestSchema,
  byteLength: BinaryAssetByteLengthSchema,
  mediaType: BinaryAssetMediaTypeSchema.optional(),
  sourceBytePersistence: z.literal("metadataOnlyNoRawBytes"),
  publicDemoAsset: z.literal(false)
}).strict();
export type PsdImportPlanSourcePsdIdentityDto = z.infer<
  typeof PsdImportPlanSourcePsdIdentitySchema
>;

export const PsdImportPlanScopeSchema = z.object({
  scopeRef: PsdProfileSourceRefSchema.refine(
    (ref) => ref.kind === "document" || ref.kind === "group",
    "Import plan scope must be a PSD document or group ref."
  ),
  scopeDisplayPath: z.array(z.string().min(1)).default([]),
  discoveryMode: z.literal("recursiveLeafCandidatePreview")
}).strict();
export type PsdImportPlanScopeDto = z.infer<typeof PsdImportPlanScopeSchema>;

export const PsdImportPlanGeneratedScaffoldSchema = z.object({
  destinationKind: z.literal("generatedPartScaffold"),
  parentPartId: PartIdSchema,
  partId: PartIdSchema,
  partDisplayName: z.string().min(1),
  drawableId: DrawableIdSchema,
  drawableDisplayName: z.string().min(1),
  textureId: TextureIdSchema,
  meshId: MeshIdSchema,
  status: z.enum([
    "previewReady",
    "resolved",
    "generatedIdCollision",
    "generatedNameCollision"
  ]),
  statusReasons: z.array(z.string().min(1)).default([])
}).strict();
export type PsdImportPlanGeneratedScaffoldDto = z.infer<
  typeof PsdImportPlanGeneratedScaffoldSchema
>;

export const PsdImportPlanCandidateSchema = z.object({
  candidateIndex: z.number().int().nonnegative(),
  sourceLayerRef: PsdSourceLayerReferenceSchema,
  sourceLayerName: z.string().min(1).optional(),
  sourceLayerPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative().optional(),
  bounds: RectSchema.optional(),
  visibleInSource: z.boolean(),
  opacityInSource: z.number().min(0).max(1).optional(),
  byteEstimate: BinaryAssetByteLengthSchema.optional(),
  statuses: z.array(PsdImportPlanCandidateStatusSchema).min(1),
  statusReasons: z.array(z.string().min(1)).default([]),
  approvalBlockedReasons: z.array(z.string().min(1)).default([]),
  generatedScaffoldPreview: PsdImportPlanGeneratedScaffoldSchema.optional()
}).strict();
export type PsdImportPlanCandidateDto = z.infer<typeof PsdImportPlanCandidateSchema>;

export const PsdImportPlanSummarySchema = z.object({
  candidateCount: z.number().int().nonnegative(),
  approvedCandidateCount: z.number().int().nonnegative(),
  notApprovedCandidateCount: z.number().int().nonnegative(),
  blockedCandidateCount: z.number().int().nonnegative(),
  hiddenCandidateCount: z.number().int().nonnegative(),
  unsupportedCandidateCount: z.number().int().nonnegative(),
  duplicateNameCount: z.number().int().nonnegative(),
  duplicateRefCount: z.number().int().nonnegative(),
  generatedIdCollisionCount: z.number().int().nonnegative(),
  generatedNameCollisionCount: z.number().int().nonnegative(),
  byteCapBlockedCount: z.number().int().nonnegative(),
  totalByteEstimate: BinaryAssetByteLengthSchema.optional(),
  approvedByteEstimate: BinaryAssetByteLengthSchema.optional()
}).strict();
export type PsdImportPlanSummaryDto = z.infer<typeof PsdImportPlanSummarySchema>;

export const PsdImportPlanCandidateEvidenceSchema = z.object({
  schemaVersion: z.literal("psd-import-plan-candidate-evidence-v1"),
  evidenceKind: z.literal("psd-import-plan-candidate-evidence-v1"),
  planId: z.string().regex(PSD_IMPORT_PLAN_ID_PATTERN),
  candidatePlanDigest: BinaryAssetDigestSchema,
  sourcePsd: PsdImportPlanSourcePsdIdentitySchema,
  parser: PsdParserEvidenceSchema.optional(),
  scope: PsdImportPlanScopeSchema,
  candidates: z.array(PsdImportPlanCandidateSchema),
  summary: PsdImportPlanSummarySchema,
  boundary: z.object({
    rawParserObjectPersistence: z.literal("notPersisted"),
    sourcePsdBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    candidateDiscoveryBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    publicDemoAsset: z.literal(false),
    allLayerOneClickImport: z.literal("notProvided"),
    recursiveGroupAutoImport: z.literal("notProvided")
  }).strict()
}).strict();
export type PsdImportPlanCandidateEvidenceDto = z.infer<
  typeof PsdImportPlanCandidateEvidenceSchema
>;

export const PsdImportPlanApprovedLeafRefSchema = z.object({
  approvalOrder: z.number().int().nonnegative(),
  sourceLayerRef: PsdSourceLayerReferenceSchema,
  sourceLayerName: z.string().min(1).optional(),
  sourceLayerPath: z.array(z.string().min(1)).default([]),
  candidateStatuses: z.array(PsdImportPlanCandidateStatusSchema).min(1),
  candidateStatusReasons: z.array(z.string().min(1)).default([]),
  generatedScaffoldPreview: PsdImportPlanGeneratedScaffoldSchema.optional(),
  resolvedGeneratedIds: PsdImportPlanGeneratedScaffoldSchema.optional()
}).strict();
export type PsdImportPlanApprovedLeafRefDto = z.infer<
  typeof PsdImportPlanApprovedLeafRefSchema
>;

export const PsdImportPlanCollisionPreflightSummarySchema = z.object({
  duplicateRefCount: z.number().int().nonnegative(),
  duplicateNameCount: z.number().int().nonnegative(),
  generatedIdCollisionCount: z.number().int().nonnegative(),
  generatedNameCollisionCount: z.number().int().nonnegative(),
  byteCapBlockedCount: z.number().int().nonnegative(),
  blockedCandidateCount: z.number().int().nonnegative(),
  notApprovedCandidateCount: z.number().int().nonnegative(),
  preflightBlockedCount: z.number().int().nonnegative()
}).strict();
export type PsdImportPlanCollisionPreflightSummaryDto = z.infer<
  typeof PsdImportPlanCollisionPreflightSummarySchema
>;

export const PsdImportPlanApprovalStatusSchema = z.enum([
  "approved",
  "candidatePlanStale",
  "candidatePlanMismatch",
  "approvalSelectionMismatch",
  "preflightBlocked"
]);
export type PsdImportPlanApprovalStatusDto = z.infer<
  typeof PsdImportPlanApprovalStatusSchema
>;

export const PsdImportPlanApprovalEvidenceSchema = z.object({
  schemaVersion: z.literal("psd-import-plan-approval-evidence-v1"),
  evidenceKind: z.literal("psd-import-plan-approval-evidence-v1"),
  approvalId: z.string().regex(PSD_IMPORT_PLAN_APPROVAL_ID_PATTERN),
  candidatePlanDigest: BinaryAssetDigestSchema,
  approvalSelectionDigest: BinaryAssetDigestSchema,
  sourcePsd: PsdImportPlanSourcePsdIdentitySchema,
  destination: z.object({
    destinationKind: z.literal("generatedPartScaffold"),
    parentPartId: PartIdSchema
  }).strict(),
  approvalStatus: PsdImportPlanApprovalStatusSchema,
  approvedLeafRefs: z.array(PsdImportPlanApprovedLeafRefSchema).min(1),
  notApprovedCandidates: z.array(PsdImportPlanCandidateSchema).default([]),
  blockedCandidates: z.array(PsdImportPlanCandidateSchema).default([]),
  collisionPreflight: PsdImportPlanCollisionPreflightSummarySchema,
  boundary: z.object({
    onlyApprovedLeafRefsPassedToBatch: z.literal(true),
    rawParserObjectPersistence: z.literal("notPersisted"),
    sourcePsdBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    materializedLayerBytePersistence: z.literal("binaryAssetRefOnlyNoInlineBytes"),
    publicDemoAsset: z.literal(false),
    allLayerOneClickImport: z.literal("notProvided"),
    recursiveGroupAutoImport: z.literal("notProvided")
  }).strict()
}).strict();
export type PsdImportPlanApprovalEvidenceDto = z.infer<
  typeof PsdImportPlanApprovalEvidenceSchema
>;

export const PsdImportPlanApprovalBridgeEvidenceSchema = z.object({
  schemaVersion: z.literal("psd-import-plan-approval-bridge-evidence-v1"),
  candidatePlan: PsdImportPlanCandidateEvidenceSchema,
  approval: PsdImportPlanApprovalEvidenceSchema
}).strict();
export type PsdImportPlanApprovalBridgeEvidenceDto = z.infer<
  typeof PsdImportPlanApprovalBridgeEvidenceSchema
>;
