import { z } from "zod";

import {
  DrawableIdSchema,
  RectSchema,
  SourceAssetIdSchema
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

export const SourceAssetSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  kind: SourceAssetKindSchema,
  filePath: z.string(),
  contentHash: z.string(),
  importProfile: SourceImportProfileSchema,
  layers: z.array(SourceLayerSchema).default([]),
  diagnostics: z.array(z.string()).default([])
});
export type SourceAssetDto = z.infer<typeof SourceAssetSchema>;

export const SourceManifestSchema = z.object({
  schemaVersion: z.literal("source-manifest-v1"),
  sourceAssets: z.array(SourceAssetSchema)
});
export type SourceManifestDto = z.infer<typeof SourceManifestSchema>;
