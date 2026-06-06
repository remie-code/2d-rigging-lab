import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  RectSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

const PSD_IMPORT_PLAN_ID_PATTERN = /^plan_[A-Za-z0-9_-]+$/;
const PSD_IMPORT_PLAN_APPROVAL_ID_PATTERN = /^approval_[A-Za-z0-9_-]+$/;
const SHA256_DIGEST_HEX_PATTERN = /^[a-f0-9]{64}$/;
const MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:; pixelFormat=rgba8)?$/;
const NO_WHITESPACE_PATTERN = /^\S+$/;

export const PsdImportPlanDigestSchema = z.object({
  algorithm: z.literal("sha256"),
  hex: z.string().regex(SHA256_DIGEST_HEX_PATTERN)
}).strict();
export type PsdImportPlanDigestDto = z.infer<typeof PsdImportPlanDigestSchema>;

export const PsdImportPlanByteLengthSchema = z.number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export type PsdImportPlanByteLengthDto = z.infer<
  typeof PsdImportPlanByteLengthSchema
>;

export const PsdImportPlanMediaTypeSchema = z.string().regex(MEDIA_TYPE_PATTERN);
export type PsdImportPlanMediaTypeDto = z.infer<typeof PsdImportPlanMediaTypeSchema>;

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

export const PsdImportPlanSourceLayerReferenceSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  sourceLayerId: z.string().min(1),
  sourceLayerName: z.string().min(1).optional(),
  sourceLayerPath: z.array(z.string().min(1)).optional()
}).strict();
export type PsdImportPlanSourceLayerReferenceDto = z.infer<
  typeof PsdImportPlanSourceLayerReferenceSchema
>;

export const PsdImportPlanSourcePsdIdentitySchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  sourceFilePath: z.string().min(1).optional(),
  digest: PsdImportPlanDigestSchema,
  byteLength: PsdImportPlanByteLengthSchema,
  mediaType: PsdImportPlanMediaTypeSchema.optional(),
  sourceBytePersistence: z.literal("metadataOnlyNoRawBytes"),
  publicDemoAsset: z.literal(false)
}).strict();
export type PsdImportPlanSourcePsdIdentityDto = z.infer<
  typeof PsdImportPlanSourcePsdIdentitySchema
>;

export const PsdImportPlanParserEvidenceSchema = z.object({
  evidenceKind: z.literal("psd-parser-evidence-v1"),
  parserName: z.string().regex(NO_WHITESPACE_PATTERN),
  parserPackageName: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  parserVersion: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  adapterName: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  adapterVersion: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  runtime: z.enum(["node", "browser", "unknown"]).optional(),
  privateShapePolicy: z.literal("parser-private-shape-excluded-v1")
}).strict();
export type PsdImportPlanParserEvidenceDto = z.infer<
  typeof PsdImportPlanParserEvidenceSchema
>;

export const PsdImportPlanSourceRefSchema = z.object({
  kind: z.enum(["document", "group"]),
  id: z.string().min(1).optional(),
  path: z.string().min(1).optional()
}).strict();
export type PsdImportPlanSourceRefDto = z.infer<typeof PsdImportPlanSourceRefSchema>;

export const PsdImportPlanScopeSchema = z.object({
  scopeRef: PsdImportPlanSourceRefSchema,
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
  sourceLayerRef: PsdImportPlanSourceLayerReferenceSchema,
  sourceLayerName: z.string().min(1).optional(),
  sourceLayerPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative().optional(),
  bounds: RectSchema.optional(),
  visibleInSource: z.boolean(),
  opacityInSource: z.number().min(0).max(1).optional(),
  byteEstimate: PsdImportPlanByteLengthSchema.optional(),
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
  totalByteEstimate: PsdImportPlanByteLengthSchema.optional(),
  approvedByteEstimate: PsdImportPlanByteLengthSchema.optional()
}).strict();
export type PsdImportPlanSummaryDto = z.infer<typeof PsdImportPlanSummarySchema>;

export const PsdImportPlanCandidateEvidenceSchema = z.object({
  schemaVersion: z.literal("psd-import-plan-candidate-evidence-v1"),
  evidenceKind: z.literal("psd-import-plan-candidate-evidence-v1"),
  planId: z.string().regex(PSD_IMPORT_PLAN_ID_PATTERN),
  candidatePlanDigest: PsdImportPlanDigestSchema,
  sourcePsd: PsdImportPlanSourcePsdIdentitySchema,
  parser: PsdImportPlanParserEvidenceSchema.optional(),
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
  sourceLayerRef: PsdImportPlanSourceLayerReferenceSchema,
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
  candidatePlanDigest: PsdImportPlanDigestSchema,
  approvalSelectionDigest: PsdImportPlanDigestSchema,
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
