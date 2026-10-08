import { z } from "zod";

import {
  JsonValueSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

import {
  BinaryAssetByteLengthSchema,
  BinaryAssetDigestSchema,
  BinaryAssetMediaTypeSchema,
  BinaryAssetReferenceSchema
} from "./binary-asset.js";
import { TextureContentInsetSchema } from "./texture-atlas.js";

const PSD_EVIDENCE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]*$/;
const PSD_LAYER_TREE_EVIDENCE_ID_PATTERN = /^layerTree_[A-Za-z0-9_-]+$/;
const PSD_MATERIALIZATION_ID_PATTERN = /^mat_[A-Za-z0-9_-]+$/;
const PSD_OPTIONS_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]*$/;
const NO_WHITESPACE_PATTERN = /^\S+$/;

export const PsdProfileSeveritySchema = z.enum(["info", "warning", "error"]);
export type PsdProfileSeverityDto = z.infer<typeof PsdProfileSeveritySchema>;

export const PsdProfileSourceRefSchema = z.object({
  kind: z.enum(["document", "group", "layer", "mask", "channel", "imageResource", "adapter"]),
  id: z.string().min(1).optional(),
  path: z.string().min(1).optional()
});
export type PsdProfileSourceRefDto = z.infer<typeof PsdProfileSourceRefSchema>;

export const PsdProfileUnsupportedFeatureScopeSchema = z.enum([
  "document",
  "group",
  "layer",
  "mask",
  "channel",
  "imageResource",
  "compression",
  "blendMode",
  "unknown"
]);
export type PsdProfileUnsupportedFeatureScopeDto = z.infer<
  typeof PsdProfileUnsupportedFeatureScopeSchema
>;

export const PsdFeatureSupportStatusSchema = z.enum(["unsupported", "notEvaluated"]);
export type PsdFeatureSupportStatusDto = z.infer<typeof PsdFeatureSupportStatusSchema>;

export const PsdParserIntakeKindSchema = z.enum([
  "parserFreeAdapterResult",
  "realPsdParseResult"
]);
export type PsdParserIntakeKindDto = z.infer<typeof PsdParserIntakeKindSchema>;

export const PsdParserRuntimeSchema = z.enum(["node", "browser", "unknown"]);
export type PsdParserRuntimeDto = z.infer<typeof PsdParserRuntimeSchema>;

export const PsdParserEvidenceSchema = z.object({
  evidenceKind: z.literal("psd-parser-evidence-v1"),
  parserName: z.string().regex(NO_WHITESPACE_PATTERN),
  parserPackageName: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  parserVersion: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  adapterName: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  adapterVersion: z.string().regex(NO_WHITESPACE_PATTERN).optional(),
  runtime: PsdParserRuntimeSchema.optional(),
  privateShapePolicy: z.literal("parser-private-shape-excluded-v1")
}).strict();
export type PsdParserEvidenceDto = z.infer<typeof PsdParserEvidenceSchema>;

export const PsdFeatureSupportEvidenceSchema = z.object({
  evidenceKind: z.literal("psd-feature-support-evidence-v1"),
  featureId: z.string().regex(PSD_EVIDENCE_ID_PATTERN),
  status: PsdFeatureSupportStatusSchema,
  scope: PsdProfileUnsupportedFeatureScopeSchema,
  severity: PsdProfileSeveritySchema,
  message: z.string().min(1),
  source: PsdProfileSourceRefSchema.optional(),
  rasterizeCandidate: z.boolean().optional(),
  manualConfirmationRequired: z.boolean().optional(),
  evidenceRefs: z.array(z.string().regex(PSD_EVIDENCE_ID_PATTERN)).optional()
}).strict();
export type PsdFeatureSupportEvidenceDto = z.infer<
  typeof PsdFeatureSupportEvidenceSchema
>;

export const PsdLayerTreeEvidenceSchema = z.object({
  evidenceKind: z.literal("psd-layer-tree-evidence-v1"),
  evidenceId: z.string().regex(PSD_LAYER_TREE_EVIDENCE_ID_PATTERN),
  intakeKind: PsdParserIntakeKindSchema,
  groupCount: z.number().int().nonnegative(),
  layerCount: z.number().int().nonnegative(),
  maxDepth: z.number().int().nonnegative().optional(),
  parser: PsdParserEvidenceSchema.optional(),
  privateShapePolicy: z.literal("parser-private-shape-excluded-v1")
}).strict();
export type PsdLayerTreeEvidenceDto = z.infer<typeof PsdLayerTreeEvidenceSchema>;

export const PsdSourceLayerReferenceSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  sourceLayerId: z.string().min(1),
  sourceLayerName: z.string().min(1).optional(),
  sourceLayerPath: z.array(z.string().min(1)).optional()
}).strict();
export type PsdSourceLayerReferenceDto = z.infer<typeof PsdSourceLayerReferenceSchema>;

export const PsdLayerMaterializationPrivacyLabelSchema = z.enum([
  "packageLocalAsset",
  "privateLocalFixture"
]);
export type PsdLayerMaterializationPrivacyLabelDto = z.infer<
  typeof PsdLayerMaterializationPrivacyLabelSchema
>;

export const PsdLayerMaterializationProvenanceSchema = z.object({
  sourceFilePath: z.string().min(1),
  sourceDigest: BinaryAssetDigestSchema.optional(),
  sourceByteLength: BinaryAssetByteLengthSchema.optional(),
  sourceMediaType: BinaryAssetMediaTypeSchema.optional(),
  privacyLabel: PsdLayerMaterializationPrivacyLabelSchema,
  publicDistribution: z.literal("notPublicDistributable"),
  fixtureId: z.string().regex(PSD_EVIDENCE_ID_PATTERN).optional(),
  derivedArtifactPath: z.string().min(1).optional(),
  generatedBy: z.string().regex(PSD_EVIDENCE_ID_PATTERN).optional(),
  publicDemoAsset: z.literal(false).optional()
}).strict();
export type PsdLayerMaterializationProvenanceDto = z.infer<
  typeof PsdLayerMaterializationProvenanceSchema
>;

export const PsdLayerExtractionOptionsSchema = z.object({
  extractionKind: z.enum(["selectedLayerRasterV1", "texturePreviewRasterV1"]),
  optionsSchemaVersion: z.literal("psd-layer-extraction-options-v1").optional(),
  options: z.record(z.string().regex(PSD_OPTIONS_ID_PATTERN), JsonValueSchema).optional()
}).strict();
export type PsdLayerExtractionOptionsDto = z.infer<
  typeof PsdLayerExtractionOptionsSchema
>;

export const PsdLayerMaterializationEvidenceSchema = z.object({
  evidenceKind: z.literal("psd-layer-materialization-evidence-v1"),
  materializationId: z.string().regex(PSD_MATERIALIZATION_ID_PATTERN),
  sourceLayerRef: PsdSourceLayerReferenceSchema,
  mediaType: BinaryAssetMediaTypeSchema,
  byteLength: BinaryAssetByteLengthSchema,
  digest: BinaryAssetDigestSchema,
  // width/height are the padded raster dimensions (content + transparent
  // alpha-edge border). contentInset locates the tightly-cropped content
  // region inside that padded raster (see texture-atlas.ts
  // TextureContentInsetSchema and boundary-transparent-margin-design.md §3.1).
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  contentInset: TextureContentInsetSchema.optional(),
  binaryAssetRef: BinaryAssetReferenceSchema.optional(),
  textureId: TextureIdSchema.optional(),
  provenance: PsdLayerMaterializationProvenanceSchema,
  parser: PsdParserEvidenceSchema.optional(),
  extraction: PsdLayerExtractionOptionsSchema.optional()
}).strict();
export type PsdLayerMaterializationEvidenceDto = z.infer<
  typeof PsdLayerMaterializationEvidenceSchema
>;
