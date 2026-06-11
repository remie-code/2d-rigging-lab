import {
  DrawableIdSchema,
  JsonValueSchema,
  MeshIdSchema,
  PartIdSchema,
  RectSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { BinaryAssetReferenceSchema } from "@private-2d-rigging-lab/authoring-core";
import { z } from "zod";

import { PsdImportPlanApprovalBridgeEvidenceSchema } from "../psd-import-plan-approval-evidence.js";

export const ImportSourceFileRefSchema = z.object({
  packageRelativePath: z.string().min(1),
  contentHash: z.string().optional(),
  binaryAssetRef: BinaryAssetReferenceSchema.optional()
});
export type ImportSourceFileRefDto = z.infer<typeof ImportSourceFileRefSchema>;

export const ImportRightsSummarySchema = z.object({
  creator: z.string().min(1),
  license: z.string().min(1),
  redistributionAllowed: z.boolean(),
  aiUsed: z.boolean()
});
export type ImportRightsSummaryDto = z.infer<typeof ImportRightsSummarySchema>;

export const PsdAdapterSeveritySchema = z.enum(["info", "warning", "error"]);
export type PsdAdapterSeverityDto = z.infer<typeof PsdAdapterSeveritySchema>;

const PSD_EVIDENCE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]*$/;
const PSD_LAYER_TREE_EVIDENCE_ID_PATTERN = /^layerTree_[A-Za-z0-9_-]+$/;
const PSD_MATERIALIZATION_ID_PATTERN = /^mat_[A-Za-z0-9_-]+$/;
const PSD_OPTIONS_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]*$/;
const SHA256_DIGEST_HEX_PATTERN = /^[a-f0-9]{64}$/;
const MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:; pixelFormat=rgba8)?$/;
const NO_WHITESPACE_PATTERN = /^\S+$/;

export const PsdAdapterSourceRefSchema = z.object({
  kind: z.enum(["document", "group", "layer", "mask", "channel", "imageResource", "adapter"]),
  id: z.string().min(1).optional(),
  path: z.string().min(1).optional()
});
export type PsdAdapterSourceRefDto = z.infer<typeof PsdAdapterSourceRefSchema>;

export const PsdAdapterDiagnosticSchema = z.object({
  checkId: z.string().min(1),
  severity: PsdAdapterSeveritySchema.default("warning"),
  message: z.string().min(1),
  source: PsdAdapterSourceRefSchema.optional(),
  evidence: z.array(z.string().min(1)).default([])
});
export type PsdAdapterDiagnosticDto = z.infer<typeof PsdAdapterDiagnosticSchema>;

export const PsdAdapterUnsupportedFeatureSchema = z.object({
  featureId: z.string().min(1),
  scope: z.enum([
    "document",
    "group",
    "layer",
    "mask",
    "channel",
    "imageResource",
    "compression",
    "blendMode",
    "unknown"
  ]),
  severity: PsdAdapterSeveritySchema.default("warning"),
  message: z.string().min(1),
  source: PsdAdapterSourceRefSchema.optional(),
  rasterizeCandidate: z.boolean().default(false),
  manualConfirmationRequired: z.boolean().default(false)
});
export type PsdAdapterUnsupportedFeatureDto = z.infer<
  typeof PsdAdapterUnsupportedFeatureSchema
>;

export const PsdAdapterFeatureSupportStatusSchema = z.enum([
  "unsupported",
  "notEvaluated"
]);
export type PsdAdapterFeatureSupportStatusDto = z.infer<
  typeof PsdAdapterFeatureSupportStatusSchema
>;

export const PsdAdapterFeatureSupportEvidenceSchema = z.object({
  evidenceKind: z.literal("psd-feature-support-evidence-v1"),
  featureId: z.string().regex(PSD_EVIDENCE_ID_PATTERN),
  status: PsdAdapterFeatureSupportStatusSchema,
  scope: PsdAdapterUnsupportedFeatureSchema.shape.scope,
  severity: PsdAdapterSeveritySchema,
  message: z.string().min(1),
  source: PsdAdapterSourceRefSchema.optional(),
  rasterizeCandidate: z.boolean().optional(),
  manualConfirmationRequired: z.boolean().optional(),
  evidenceRefs: z.array(z.string().regex(PSD_EVIDENCE_ID_PATTERN)).optional()
}).strict();
export type PsdAdapterFeatureSupportEvidenceDto = z.infer<
  typeof PsdAdapterFeatureSupportEvidenceSchema
>;

export const PsdAdapterParserIntakeKindSchema = z.enum([
  "parserFreeAdapterResult",
  "realPsdParseResult"
]);
export type PsdAdapterParserIntakeKindDto = z.infer<
  typeof PsdAdapterParserIntakeKindSchema
>;

export const PsdAdapterParserRuntimeSchema = z.enum(["node", "browser", "unknown"]);
export type PsdAdapterParserRuntimeDto = z.infer<typeof PsdAdapterParserRuntimeSchema>;

export const PsdAdapterParserEvidenceSchema = z.object({
  evidenceKind: z.literal("psd-parser-evidence-v1"),
  parserName: z.string().regex(NO_WHITESPACE_PATTERN),
  parserPackageName: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  parserVersion: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  adapterName: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  adapterVersion: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  runtime: PsdAdapterParserRuntimeSchema.optional(),
  privateShapePolicy: z.literal("parser-private-shape-excluded-v1")
}).strict();
export type PsdAdapterParserEvidenceDto = z.infer<typeof PsdAdapterParserEvidenceSchema>;

export const PsdAdapterLayerTreeEvidenceSchema = z.object({
  evidenceKind: z.literal("psd-layer-tree-evidence-v1"),
  evidenceId: z.string().regex(PSD_LAYER_TREE_EVIDENCE_ID_PATTERN),
  intakeKind: PsdAdapterParserIntakeKindSchema,
  groupCount: z.number().int().nonnegative(),
  layerCount: z.number().int().nonnegative(),
  maxDepth: z.number().int().nonnegative().optional(),
  parser: PsdAdapterParserEvidenceSchema.optional(),
  privateShapePolicy: z.literal("parser-private-shape-excluded-v1")
}).strict();
export type PsdAdapterLayerTreeEvidenceDto = z.infer<
  typeof PsdAdapterLayerTreeEvidenceSchema
>;

const PsdAdapterDigestSchema = z.object({
  algorithm: z.literal("sha256"),
  hex: z.string().regex(SHA256_DIGEST_HEX_PATTERN)
}).strict();

const PsdAdapterByteLengthSchema = z.number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

const PsdAdapterMediaTypeSchema = z.string().regex(MEDIA_TYPE_PATTERN);

export const PsdAdapterSourceLayerReferenceSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  sourceLayerId: z.string().min(1),
  sourceLayerName: z.string().min(1).optional(),
  sourceLayerPath: z.array(z.string().min(1)).optional()
}).strict();
export type PsdAdapterSourceLayerReferenceDto = z.infer<
  typeof PsdAdapterSourceLayerReferenceSchema
>;

export const PsdAdapterLayerMaterializationProvenanceSchema = z.object({
  sourceFilePath: z.string().min(1),
  sourceDigest: PsdAdapterDigestSchema.optional(),
  sourceByteLength: PsdAdapterByteLengthSchema.optional(),
  sourceMediaType: PsdAdapterMediaTypeSchema.optional(),
  privacyLabel: z.enum(["packageLocalAsset", "privateLocalFixture"]),
  publicDistribution: z.literal("notPublicDistributable"),
  fixtureId: z.string().regex(PSD_EVIDENCE_ID_PATTERN).optional(),
  derivedArtifactPath: z.string().min(1).optional(),
  generatedBy: z.string().regex(PSD_EVIDENCE_ID_PATTERN).optional(),
  publicDemoAsset: z.literal(false).optional()
}).strict();
export type PsdAdapterLayerMaterializationProvenanceDto = z.infer<
  typeof PsdAdapterLayerMaterializationProvenanceSchema
>;

export const PsdAdapterLayerExtractionOptionsSchema = z.object({
  extractionKind: z.enum(["selectedLayerRasterV1", "texturePreviewRasterV1"]),
  optionsSchemaVersion: z.literal("psd-layer-extraction-options-v1").optional(),
  options: z.record(z.string().regex(PSD_OPTIONS_ID_PATTERN), JsonValueSchema).optional()
}).strict();
export type PsdAdapterLayerExtractionOptionsDto = z.infer<
  typeof PsdAdapterLayerExtractionOptionsSchema
>;

export const PsdAdapterLayerMaterializationEvidenceSchema = z.object({
  evidenceKind: z.literal("psd-layer-materialization-evidence-v1"),
  materializationId: z.string().regex(PSD_MATERIALIZATION_ID_PATTERN),
  sourceLayerRef: PsdAdapterSourceLayerReferenceSchema,
  mediaType: PsdAdapterMediaTypeSchema,
  byteLength: PsdAdapterByteLengthSchema,
  digest: PsdAdapterDigestSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  binaryAssetRef: BinaryAssetReferenceSchema.optional(),
  textureId: TextureIdSchema.optional(),
  provenance: PsdAdapterLayerMaterializationProvenanceSchema,
  parser: PsdAdapterParserEvidenceSchema.optional(),
  extraction: PsdAdapterLayerExtractionOptionsSchema.optional()
}).strict();
export type PsdAdapterLayerMaterializationEvidenceDto = z.infer<
  typeof PsdAdapterLayerMaterializationEvidenceSchema
>;

export const PsdAdapterCanvasSchema = z.object({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  bounds: RectSchema.optional()
});
export type PsdAdapterCanvasDto = z.infer<typeof PsdAdapterCanvasSchema>;

export const PsdAdapterBlendModeSchema = z.object({
  modeKey: z.string().min(1),
  normalizedMode: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  supportedByMvp: z.boolean().default(false),
  source: PsdAdapterSourceRefSchema.optional()
});
export type PsdAdapterBlendModeDto = z.infer<typeof PsdAdapterBlendModeSchema>;

export const PsdAdapterSourceGroupSchema = z.object({
  sourceGroupId: z.string().min(1),
  originalName: z.string().min(1),
  normalizedName: z.string().min(1),
  parentGroupId: z.string().min(1).optional(),
  groupPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative(),
  visibleInSource: z.boolean().default(true),
  localVisibleInSource: z.boolean().optional(),
  effectiveVisibleInSource: z.boolean().optional(),
  opacityInSource: z.number().min(0).max(1).default(1),
  bounds: RectSchema.optional(),
  blendMode: PsdAdapterBlendModeSchema.optional(),
  targetPartId: PartIdSchema.optional(),
  unsupportedFeatures: z.array(PsdAdapterUnsupportedFeatureSchema).default([]),
  featureSupportEvidence: z.array(PsdAdapterFeatureSupportEvidenceSchema).optional()
});
export type PsdAdapterSourceGroupDto = z.infer<typeof PsdAdapterSourceGroupSchema>;

export const PsdAdapterSourceLayerRoleSchema = z.enum([
  "editableLayer",
  "guideImage",
  "referenceOnly",
  "unsupported"
]);
export type PsdAdapterSourceLayerRoleDto = z.infer<
  typeof PsdAdapterSourceLayerRoleSchema
>;

export const PsdAdapterSourceLayerSchema = z.object({
  sourceLayerId: z.string().min(1),
  originalName: z.string().min(1),
  normalizedName: z.string().min(1),
  parentGroupId: z.string().min(1).optional(),
  groupPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative(),
  bounds: RectSchema,
  visibleInSource: z.boolean().default(true),
  localVisibleInSource: z.boolean().optional(),
  effectiveVisibleInSource: z.boolean().optional(),
  opacityInSource: z.number().min(0).max(1).default(1),
  role: PsdAdapterSourceLayerRoleSchema.default("editableLayer"),
  blendMode: PsdAdapterBlendModeSchema.optional(),
  unsupportedFeatures: z.array(PsdAdapterUnsupportedFeatureSchema).default([]),
  texturePreviewReference: z.string().min(1).optional(),
  texturePreviewBinaryAssetRef: BinaryAssetReferenceSchema.optional(),
  textureId: TextureIdSchema.optional(),
  targetPartId: PartIdSchema.optional(),
  featureSupportEvidence: z.array(PsdAdapterFeatureSupportEvidenceSchema).optional()
});
export type PsdAdapterSourceLayerDto = z.infer<typeof PsdAdapterSourceLayerSchema>;

export const PsdAdapterResultSchema = z.object({
  schemaVersion: z.literal("psd-adapter-result-v1"),
  sourceProfile: z.literal("layered-character-psd-profile-v1"),
  adapterName: z.string().min(1),
  adapterVersion: z.string().min(1).optional(),
  intakeKind: PsdAdapterParserIntakeKindSchema.optional(),
  parser: PsdAdapterParserEvidenceSchema.optional(),
  canvas: PsdAdapterCanvasSchema,
  sourceGroups: z.array(PsdAdapterSourceGroupSchema).default([]),
  sourceLayers: z.array(PsdAdapterSourceLayerSchema).default([]),
  unsupportedFeatures: z.array(PsdAdapterUnsupportedFeatureSchema).default([]),
  featureSupportEvidence: z.array(PsdAdapterFeatureSupportEvidenceSchema).optional(),
  layerTreeEvidence: PsdAdapterLayerTreeEvidenceSchema.optional(),
  materializationEvidence: z.array(PsdAdapterLayerMaterializationEvidenceSchema).optional(),
  diagnostics: z.array(PsdAdapterDiagnosticSchema).default([])
});
export type PsdAdapterResultDto = z.infer<typeof PsdAdapterResultSchema>;

export const ImportPsdSourceAssetPayloadSchema = z.object({
  sourceAssetId: SourceAssetIdSchema.optional(),
  fileRef: ImportSourceFileRefSchema,
  importProfile: z.literal("layered-character-psd-profile-v1"),
  requestedLayerRoles: z
    .record(z.string(), z.enum(["editableLayer", "guideImage", "referenceOnly"]))
    .default({}),
  adapterResult: PsdAdapterResultSchema.optional(),
  rights: ImportRightsSummarySchema
});
export type ImportPsdSourceAssetPayloadDto = z.infer<typeof ImportPsdSourceAssetPayloadSchema>;

const LockedTargetIdsSchema = z.array(z.string().min(1)).default([]);

export const PsdLayerMaterializationDestinationPartSchema = z.discriminatedUnion("destinationKind", [
  z.object({
    destinationKind: z.literal("existingPart"),
    partId: PartIdSchema
  }).strict(),
  z.object({
    destinationKind: z.literal("newPart"),
    partId: PartIdSchema.optional(),
    displayName: z.string().min(1),
    parentPartId: PartIdSchema.optional()
  }).strict()
]);
export type PsdLayerMaterializationDestinationPartDto = z.infer<
  typeof PsdLayerMaterializationDestinationPartSchema
>;

export const ImportPsdLayerMaterializationPayloadSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  materialization: PsdAdapterLayerMaterializationEvidenceSchema,
  textureId: TextureIdSchema.optional(),
  drawableId: DrawableIdSchema.optional(),
  meshId: MeshIdSchema.optional(),
  drawableDisplayName: z.string().min(1).optional(),
  destinationPart: PsdLayerMaterializationDestinationPartSchema,
  initialBounds: RectSchema.optional(),
  lockedTargetIds: LockedTargetIdsSchema
}).strict();
export type ImportPsdLayerMaterializationPayloadDto = z.infer<
  typeof ImportPsdLayerMaterializationPayloadSchema
>;

export const PsdLayerMaterializationBatchEntrySchema = z.object({
  materialization: PsdAdapterLayerMaterializationEvidenceSchema,
  initialBounds: RectSchema.optional()
}).strict();
export type PsdLayerMaterializationBatchEntryDto = z.infer<
  typeof PsdLayerMaterializationBatchEntrySchema
>;

export const PsdLayerMaterializationBatchDestinationSchema = z.object({
  destinationKind: z.literal("generatedPartScaffold"),
  parentPartId: PartIdSchema
}).strict();
export type PsdLayerMaterializationBatchDestinationDto = z.infer<
  typeof PsdLayerMaterializationBatchDestinationSchema
>;

export const ImportPsdLayerMaterializationBatchPayloadSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  batchId: z.string().regex(/^batch_[A-Za-z0-9_-]+$/),
  destination: PsdLayerMaterializationBatchDestinationSchema,
  importPlanBridge: PsdImportPlanApprovalBridgeEvidenceSchema.optional(),
  entries: z.array(PsdLayerMaterializationBatchEntrySchema).min(1),
  lockedTargetIds: LockedTargetIdsSchema
}).strict();
export type ImportPsdLayerMaterializationBatchPayloadDto = z.infer<
  typeof ImportPsdLayerMaterializationBatchPayloadSchema
>;

export const SplitPngSourceLayerMetadataSchema = z.object({
  sourceLayerId: z.string().min(1),
  imagePath: z.string().min(1).optional(),
  originalName: z.string().min(1),
  normalizedName: z.string().min(1).optional(),
  groupPath: z.array(z.string()).default([]),
  bounds: RectSchema.optional(),
  visibleInSource: z.boolean().default(true),
  localVisibleInSource: z.boolean().optional(),
  opacityInSource: z.number().min(0).max(1).default(1),
  role: z.enum(["editableLayer", "guideImage", "referenceOnly", "unsupported"]).default("editableLayer"),
  unsupportedFeatures: z.array(z.string()).default([]),
  texturePreviewReference: z.string().min(1).optional(),
  texturePreviewBinaryAssetRef: BinaryAssetReferenceSchema.optional(),
  textureId: TextureIdSchema.optional(),
  targetPartId: PartIdSchema.optional()
});
export type SplitPngSourceLayerMetadataDto = z.infer<typeof SplitPngSourceLayerMetadataSchema>;

export const SplitPngImportRightsMetadataSchema = z.object({
  rightsStatus: z.enum(["cleared", "needs_review", "blocked"]),
  license: z.string().min(1),
  redistributionAllowed: z.boolean()
});
export type SplitPngImportRightsMetadataDto = z.infer<typeof SplitPngImportRightsMetadataSchema>;

export const SplitPngImportProvenanceMetadataSchema = z.object({
  creator: z.string().min(1),
  sourceUrl: z.string().min(1).optional(),
  license: z.string().min(1),
  redistributionAllowed: z.boolean(),
  aiUsed: z.boolean(),
  transformHistory: z.array(z.string()).default([])
});
export type SplitPngImportProvenanceMetadataDto = z.infer<
  typeof SplitPngImportProvenanceMetadataSchema
>;

export const SplitPngSourceAssetPayloadSchema = z.object({
  sourceAssetId: SourceAssetIdSchema.optional(),
  manifestPath: z.string().optional(),
  importProfile: z.string(),
  contentHash: z.string().min(1).optional(),
  binaryAssetRef: BinaryAssetReferenceSchema.optional(),
  defaultPartId: PartIdSchema.optional(),
  placementPolicy: z.enum(["use-metadata", "origin-with-warning"]),
  layers: z.array(SplitPngSourceLayerMetadataSchema).default([]),
  rights: SplitPngImportRightsMetadataSchema.optional(),
  provenance: SplitPngImportProvenanceMetadataSchema.optional()
});
export type SplitPngSourceAssetPayloadDto = z.infer<typeof SplitPngSourceAssetPayloadSchema>;
