import { z } from "zod";

import {
  DrawableIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  Vec2Schema
} from "@private-2d-rigging-lab/contracts";

import { BinaryAssetReferenceSchema } from "./binary-asset.js";
import { isPackageRelativePath } from "./package-file-paths.js";

const PACKAGE_LOCAL_PREVIEW_PATH_PREFIXES = [
  "assets/sources/",
  "assets/textures/",
  "assets/thumbnails/"
] as const;

const PackageLocalTexturePreviewPathSchema = z.string().refine(
  (path) =>
    isPackageRelativePath(path) &&
    PACKAGE_LOCAL_PREVIEW_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)),
  "Texture preview package-local file paths must stay under assets/sources, assets/textures, or assets/thumbnails."
);

const PackageLocalTextureAssetPathSchema = z.string().refine(
  (path) => isPackageRelativePath(path) && path.startsWith("assets/textures/"),
  "Texture atlas entry file paths must stay under assets/textures."
);

const DeterministicImageDataUrlSchema = z.string().regex(
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
  "Texture preview data URLs must be deterministic base64 image data URLs."
);

export const TexturePreviewReferenceSchema = z.discriminatedUnion("referenceKind", [
  z.object({
    referenceKind: z.literal("package-local-file-v1"),
    filePath: PackageLocalTexturePreviewPathSchema
  }),
  z.object({
    referenceKind: z.literal("deterministic-data-url-v1"),
    dataUrl: DeterministicImageDataUrlSchema
  })
]);
export type TexturePreviewReferenceDto = z.infer<typeof TexturePreviewReferenceSchema>;

export const TexturePreviewAssetSchema = z.object({
  previewAssetId: z.string().min(1),
  textureId: TextureIdSchema,
  reference: TexturePreviewReferenceSchema,
  contentHash: z.string().optional(),
  sourceAssetId: SourceAssetIdSchema,
  sourceLayerId: z.string().min(1),
  provenanceId: ProvenanceIdSchema,
  rightsAssetId: z.string().min(1)
});
export type TexturePreviewAssetDto = z.infer<typeof TexturePreviewAssetSchema>;

export const TextureAtlasEntrySchema = z.object({
  textureId: TextureIdSchema,
  filePath: PackageLocalTextureAssetPathSchema,
  contentHash: z.string().optional(),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    pixelFormat: z.literal("rgba8")
  }).optional(),
  sourceAssetId: SourceAssetIdSchema.optional(),
  sourceLayerId: z.string().optional(),
  provenanceId: ProvenanceIdSchema.optional(),
  binaryAssetRef: BinaryAssetReferenceSchema.optional()
});
export type TextureAtlasEntryDto = z.infer<typeof TextureAtlasEntrySchema>;

export const TextureAtlasRectPixelsSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});
export type TextureAtlasRectPixelsDto = z.infer<typeof TextureAtlasRectPixelsSchema>;

export const TextureAtlasSizePixelsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive()
});
export type TextureAtlasSizePixelsDto = z.infer<typeof TextureAtlasSizePixelsSchema>;

export const TextureAtlasUvRectSchema = z.object({
  topLeft: Vec2Schema,
  bottomRight: Vec2Schema
});
export type TextureAtlasUvRectDto = z.infer<typeof TextureAtlasUvRectSchema>;

export const TextureAtlasPlacementSchema = z.object({
  placementId: z.string().regex(/^atlas_place_[A-Za-z0-9_-]+$/),
  pageId: z.string().regex(/^atlas_page_[A-Za-z0-9_-]+$/),
  drawableId: DrawableIdSchema,
  meshId: MeshIdSchema,
  originalTextureId: TextureIdSchema,
  atlasTextureId: TextureIdSchema,
  sourceTextureSize: TextureAtlasSizePixelsSchema,
  sourceRectPixels: TextureAtlasRectPixelsSchema,
  contentRectPixels: TextureAtlasRectPixelsSchema,
  paddedRectPixels: TextureAtlasRectPixelsSchema,
  uvRect: TextureAtlasUvRectSchema,
  hiddenAtApply: z.boolean().default(false),
  hiddenReasons: z.array(z.enum([
    "runtime-visibility-off",
    "editor-part-hidden"
  ])).default([])
});
export type TextureAtlasPlacementDto = z.infer<typeof TextureAtlasPlacementSchema>;

export const TextureAtlasPageSchema = z.object({
  pageId: z.string().regex(/^atlas_page_[A-Za-z0-9_-]+$/),
  textureId: TextureIdSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pixelFormat: z.literal("rgba8"),
  placements: z.array(TextureAtlasPlacementSchema)
});
export type TextureAtlasPageDto = z.infer<typeof TextureAtlasPageSchema>;

export const TextureAtlasLayoutSettingsSchema = z.object({
  algorithmId: z.literal("single-page-shelf-v1"),
  pageWidth: z.number().int().positive(),
  pageHeight: z.number().int().positive(),
  paddingPixels: z.number().int().nonnegative(),
  edgeExtrusion: z.object({
    enabled: z.boolean(),
    pixels: z.number().int().nonnegative()
  })
});
export type TextureAtlasLayoutSettingsDto = z.infer<
  typeof TextureAtlasLayoutSettingsSchema
>;

export const TextureAtlasSourceSignatureSchema = z.object({
  schemaVersion: z.literal("texture-atlas-source-signature-v1"),
  inputVersion: z.literal("atlas-source-inputs-v1"),
  algorithmId: z.literal("stable-json-fnv1a32-v1"),
  digest: z.string().regex(/^fnv1a32:[a-f0-9]{8}$/),
  boundDrawableIds: z.array(DrawableIdSchema),
  packableDrawableIds: z.array(DrawableIdSchema)
});
export type TextureAtlasSourceSignatureDto = z.infer<
  typeof TextureAtlasSourceSignatureSchema
>;

export const TextureAtlasLayoutSummarySchema = z.object({
  schemaVersion: z.literal("texture-atlas-layout-v1"),
  layoutId: z.string().regex(/^atlas_layout_[A-Za-z0-9_-]+$/),
  atlasTextureId: TextureIdSchema,
  sourceTexturePolicy: z.literal("retain-source-textures-v1"),
  generatedByOperationId: OperationIdSchema.optional(),
  sourceSignature: TextureAtlasSourceSignatureSchema.optional(),
  settings: TextureAtlasLayoutSettingsSchema,
  pages: z.array(TextureAtlasPageSchema).length(1)
});
export type TextureAtlasLayoutSummaryDto = z.infer<
  typeof TextureAtlasLayoutSummarySchema
>;

export const TextureAtlasFileSchema = z.object({
  schemaVersion: z.literal("texture-atlas-v1"),
  textures: z.array(TextureAtlasEntrySchema),
  previewAssets: z.array(TexturePreviewAssetSchema).optional(),
  layoutSummary: TextureAtlasLayoutSummarySchema.optional()
});
export type TextureAtlasFileDto = z.infer<typeof TextureAtlasFileSchema>;
