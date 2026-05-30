import {
  PartIdSchema,
  RectSchema,
  SourceAssetIdSchema
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

export const ImportPsdSourceAssetPayloadSchema = z.object({
  sourceAssetId: SourceAssetIdSchema.optional(),
  fileRef: ImportSourceFileRefSchema,
  importProfile: z.literal("layered-character-psd-profile-v1"),
  requestedLayerRoles: z
    .record(z.string(), z.enum(["editableLayer", "guideImage", "referenceOnly"]))
    .default({}),
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
  unsupportedFeatures: z.array(z.string()).default([])
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
