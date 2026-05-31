import {
  PartIdSchema,
  RectSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const ImportSourceFileRefSchema = z.object({
  packageRelativePath: z.string().min(1),
  contentHash: z.string().optional()
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
  opacityInSource: z.number().min(0).max(1).default(1),
  bounds: RectSchema.optional(),
  blendMode: PsdAdapterBlendModeSchema.optional(),
  targetPartId: PartIdSchema.optional(),
  unsupportedFeatures: z.array(PsdAdapterUnsupportedFeatureSchema).default([])
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
  opacityInSource: z.number().min(0).max(1).default(1),
  role: PsdAdapterSourceLayerRoleSchema.default("editableLayer"),
  blendMode: PsdAdapterBlendModeSchema.optional(),
  unsupportedFeatures: z.array(PsdAdapterUnsupportedFeatureSchema).default([]),
  texturePreviewReference: z.string().min(1).optional(),
  textureId: TextureIdSchema.optional(),
  targetPartId: PartIdSchema.optional()
});
export type PsdAdapterSourceLayerDto = z.infer<typeof PsdAdapterSourceLayerSchema>;

export const PsdAdapterResultSchema = z.object({
  schemaVersion: z.literal("psd-adapter-result-v1"),
  sourceProfile: z.literal("layered-character-psd-profile-v1"),
  adapterName: z.string().min(1),
  canvas: PsdAdapterCanvasSchema,
  sourceGroups: z.array(PsdAdapterSourceGroupSchema).default([]),
  sourceLayers: z.array(PsdAdapterSourceLayerSchema).default([]),
  unsupportedFeatures: z.array(PsdAdapterUnsupportedFeatureSchema).default([]),
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

export const SplitPngSourceLayerMetadataSchema = z.object({
  sourceLayerId: z.string().min(1),
  imagePath: z.string().min(1).optional(),
  originalName: z.string().min(1),
  normalizedName: z.string().min(1).optional(),
  groupPath: z.array(z.string()).default([]),
  bounds: RectSchema.optional(),
  visibleInSource: z.boolean().default(true),
  opacityInSource: z.number().min(0).max(1).default(1),
  role: z.enum(["editableLayer", "guideImage", "referenceOnly", "unsupported"]).default("editableLayer"),
  unsupportedFeatures: z.array(z.string()).default([]),
  texturePreviewReference: z.string().min(1).optional(),
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
  defaultPartId: PartIdSchema.optional(),
  placementPolicy: z.enum(["use-metadata", "origin-with-warning"]),
  layers: z.array(SplitPngSourceLayerMetadataSchema).default([]),
  rights: SplitPngImportRightsMetadataSchema.optional(),
  provenance: SplitPngImportProvenanceMetadataSchema.optional()
});
export type SplitPngSourceAssetPayloadDto = z.infer<typeof SplitPngSourceAssetPayloadSchema>;
