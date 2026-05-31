import { z } from "zod";

import {
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
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
  sourceAssetId: SourceAssetIdSchema.optional(),
  sourceLayerId: z.string().optional(),
  provenanceId: ProvenanceIdSchema.optional(),
  binaryAssetRef: BinaryAssetReferenceSchema.optional()
});
export type TextureAtlasEntryDto = z.infer<typeof TextureAtlasEntrySchema>;

export const TextureAtlasFileSchema = z.object({
  schemaVersion: z.literal("texture-atlas-v1"),
  textures: z.array(TextureAtlasEntrySchema),
  previewAssets: z.array(TexturePreviewAssetSchema).optional()
});
export type TextureAtlasFileDto = z.infer<typeof TextureAtlasFileSchema>;
