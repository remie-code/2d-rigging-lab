import { z } from "zod";

import {
  DrawableIdSchema,
  PartIdSchema,
  RectSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

export const SourceAssetKindSchema = z.enum([
  "psd-source-v1",
  "split-png-set-v1",
  "generated-fixture-v1"
]);
export type SourceAssetKindDto = z.infer<typeof SourceAssetKindSchema>;

export const SourceImportProfileSchema = z.enum([
  "layered-character-psd-profile-v1",
  "split-png-fallback-v1"
]);
export type SourceImportProfileDto = z.infer<typeof SourceImportProfileSchema>;

export const SourceLayerRoleSchema = z.enum([
  "editableLayer",
  "guideImage",
  "referenceOnly",
  "unsupported"
]);
export type SourceLayerRoleDto = z.infer<typeof SourceLayerRoleSchema>;

export const SourceLayerSchema = z.object({
  sourceLayerId: z.string(),
  sourceAssetId: SourceAssetIdSchema,
  originalName: z.string(),
  normalizedName: z.string(),
  groupPath: z.array(z.string()),
  bounds: RectSchema,
  visibleInSource: z.boolean(),
  opacityInSource: z.number().min(0).max(1),
  role: SourceLayerRoleSchema,
  unsupportedFeatures: z.array(z.string()).default([]),
  mappedDrawableIds: z.array(DrawableIdSchema).default([])
});
export type SourceLayerDto = z.infer<typeof SourceLayerSchema>;

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

export const PsdProfileUnsupportedFeatureSchema = z.object({
  featureId: z.string().min(1),
  scope: PsdProfileUnsupportedFeatureScopeSchema,
  severity: PsdProfileSeveritySchema.default("warning"),
  message: z.string().min(1),
  source: PsdProfileSourceRefSchema.optional(),
  rasterizeCandidate: z.boolean().default(false),
  manualConfirmationRequired: z.boolean().default(false)
});
export type PsdProfileUnsupportedFeatureDto = z.infer<typeof PsdProfileUnsupportedFeatureSchema>;

export const PsdProfileAdapterDiagnosticSchema = z.object({
  checkId: z.string().min(1),
  severity: PsdProfileSeveritySchema.default("warning"),
  message: z.string().min(1),
  source: PsdProfileSourceRefSchema.optional(),
  evidence: z.array(z.string().min(1)).default([])
});
export type PsdProfileAdapterDiagnosticDto = z.infer<typeof PsdProfileAdapterDiagnosticSchema>;

export const PsdProfileCanvasSchema = z.object({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  bounds: RectSchema.optional()
});
export type PsdProfileCanvasDto = z.infer<typeof PsdProfileCanvasSchema>;

export const PsdProfileBlendModeSchema = z.object({
  modeKey: z.string().min(1),
  normalizedMode: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  supportedByMvp: z.boolean().default(false),
  source: PsdProfileSourceRefSchema.optional()
});
export type PsdProfileBlendModeDto = z.infer<typeof PsdProfileBlendModeSchema>;

export const PsdProfileAdapterEvidenceSchema = z.object({
  adapterName: z.string().min(1),
  adapterResultSchemaVersion: z.literal("psd-adapter-result-v1"),
  sourceProfile: z.literal("layered-character-psd-profile-v1"),
  evidenceKind: z.literal("adapter-supplied-metadata-v1")
});
export type PsdProfileAdapterEvidenceDto = z.infer<typeof PsdProfileAdapterEvidenceSchema>;

export const PsdProfileCompatibilityPolicySchema = z.object({
  structuredProfilePrecedence: z.literal("structured-profile-preferred-v1"),
  flattenedDiagnosticsFallback: z.literal("sourceAsset.diagnostics-summary-fallback-v1"),
  flattenedUnsupportedFeaturesFallback: z.literal(
    "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
  )
});
export type PsdProfileCompatibilityPolicyDto = z.infer<
  typeof PsdProfileCompatibilityPolicySchema
>;

export const PsdProfileSourceGroupSchema = z.object({
  sourceGroupId: z.string().min(1),
  originalName: z.string().min(1),
  normalizedName: z.string().min(1),
  parentGroupId: z.string().min(1).optional(),
  groupPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative(),
  visibleInSource: z.boolean().default(true),
  opacityInSource: z.number().min(0).max(1).default(1),
  bounds: RectSchema.optional(),
  blendMode: PsdProfileBlendModeSchema.optional(),
  targetPartId: PartIdSchema.optional(),
  unsupportedFeatures: z.array(PsdProfileUnsupportedFeatureSchema).default([])
});
export type PsdProfileSourceGroupDto = z.infer<typeof PsdProfileSourceGroupSchema>;

export const PsdProfileSourceLayerSchema = z.object({
  sourceLayerId: z.string().min(1),
  originalName: z.string().min(1),
  normalizedName: z.string().min(1),
  parentGroupId: z.string().min(1).optional(),
  groupPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative(),
  bounds: RectSchema,
  visibleInSource: z.boolean().default(true),
  opacityInSource: z.number().min(0).max(1).default(1),
  role: SourceLayerRoleSchema.default("editableLayer"),
  blendMode: PsdProfileBlendModeSchema.optional(),
  unsupportedFeatures: z.array(PsdProfileUnsupportedFeatureSchema).default([]),
  texturePreviewReference: z.string().min(1).optional(),
  textureId: TextureIdSchema.optional(),
  targetPartId: PartIdSchema.optional()
});
export type PsdProfileSourceLayerDto = z.infer<typeof PsdProfileSourceLayerSchema>;

export const LayeredCharacterPsdProfileSchema = z.object({
  schemaVersion: z.literal("layered-character-psd-profile-v1"),
  adapter: PsdProfileAdapterEvidenceSchema,
  canvas: PsdProfileCanvasSchema,
  sourceGroups: z.array(PsdProfileSourceGroupSchema).default([]),
  sourceLayers: z.array(PsdProfileSourceLayerSchema).default([]),
  unsupportedFeatures: z.array(PsdProfileUnsupportedFeatureSchema).default([]),
  diagnostics: z.array(PsdProfileAdapterDiagnosticSchema).default([]),
  compatibility: PsdProfileCompatibilityPolicySchema
});
export type LayeredCharacterPsdProfileDto = z.infer<typeof LayeredCharacterPsdProfileSchema>;

export const SourceAssetSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  kind: SourceAssetKindSchema,
  filePath: z.string(),
  contentHash: z.string(),
  importProfile: SourceImportProfileSchema,
  layers: z.array(SourceLayerSchema).default([]),
  diagnostics: z.array(z.string()).default([]),
  psdProfile: LayeredCharacterPsdProfileSchema.optional()
});
export type SourceAssetDto = z.infer<typeof SourceAssetSchema>;

export const SourceManifestSchema = z.object({
  schemaVersion: z.literal("source-manifest-v1"),
  sourceAssets: z.array(SourceAssetSchema)
});
export type SourceManifestDto = z.infer<typeof SourceManifestSchema>;
