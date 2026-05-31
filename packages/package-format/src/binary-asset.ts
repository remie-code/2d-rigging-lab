import { z } from "zod";

import {
  OperationIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

import { isPackageRelativePath } from "./package-file-paths.js";

const PACKAGE_LOCAL_BINARY_ASSET_PATH_PREFIXES = [
  "assets/sources/",
  "assets/textures/",
  "assets/thumbnails/"
] as const;

const SHA256_DIGEST_HEX_PATTERN = /^[a-f0-9]{64}$/;
const LOWERCASE_MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

export const BinaryAssetIdSchema = z.string().regex(/^bin_[A-Za-z0-9_-]+$/);
export type BinaryAssetIdDto = z.infer<typeof BinaryAssetIdSchema>;

export const BinaryAssetPackageRelativePathSchema = z.string().refine(
  (path) =>
    isPackageRelativePath(path) &&
    PACKAGE_LOCAL_BINARY_ASSET_PATH_PREFIXES.some((prefix) => path.startsWith(prefix)),
  "Binary asset package paths must stay under assets/sources, assets/textures, or assets/thumbnails."
);
export type BinaryAssetPackageRelativePathDto = z.infer<
  typeof BinaryAssetPackageRelativePathSchema
>;

export const BinaryAssetDigestSchema = z.object({
  algorithm: z.literal("sha256"),
  hex: z.string().regex(SHA256_DIGEST_HEX_PATTERN)
}).strict();
export type BinaryAssetDigestDto = z.infer<typeof BinaryAssetDigestSchema>;

export const BinaryAssetByteLengthSchema = z.number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export type BinaryAssetByteLengthDto = z.infer<typeof BinaryAssetByteLengthSchema>;

export const BinaryAssetMediaTypeSchema = z.string().regex(LOWERCASE_MEDIA_TYPE_PATTERN);
export type BinaryAssetMediaTypeDto = z.infer<typeof BinaryAssetMediaTypeSchema>;

export const BinaryAssetStorageStatusSchema = z.enum([
  "stored-package-local-v1",
  "missing-package-local-bytes-v1",
  "storage-unsupported-v1"
]);
export type BinaryAssetStorageStatusDto = z.infer<typeof BinaryAssetStorageStatusSchema>;

export const BinaryAssetRoleSchema = z.enum([
  "source-original-v1",
  "texture-raster-v1",
  "thumbnail-v1",
  "generated-fixture-v1",
  "unknown-binary-v1"
]);
export type BinaryAssetRoleDto = z.infer<typeof BinaryAssetRoleSchema>;

const binaryAssetReferenceFields = {
  referenceKind: z.literal("package-binary-asset-ref-v1"),
  binaryAssetId: BinaryAssetIdSchema,
  packageRelativePath: BinaryAssetPackageRelativePathSchema,
  digest: BinaryAssetDigestSchema,
  byteLength: BinaryAssetByteLengthSchema,
  mediaType: BinaryAssetMediaTypeSchema,
  storageStatus: BinaryAssetStorageStatusSchema,
  provenanceId: ProvenanceIdSchema,
  rightsAssetId: z.string().min(1)
} as const;

export const BinaryAssetReferenceSchema = z.object(binaryAssetReferenceFields).strict();
export type BinaryAssetReferenceDto = z.infer<typeof BinaryAssetReferenceSchema>;

export const BinaryAssetEntrySchema = z.object({
  binaryAssetId: BinaryAssetIdSchema,
  role: BinaryAssetRoleSchema,
  packageRelativePath: BinaryAssetPackageRelativePathSchema,
  digest: BinaryAssetDigestSchema,
  byteLength: BinaryAssetByteLengthSchema,
  mediaType: BinaryAssetMediaTypeSchema,
  storageStatus: BinaryAssetStorageStatusSchema,
  provenanceId: ProvenanceIdSchema,
  rightsAssetId: z.string().min(1),
  sourceAssetId: SourceAssetIdSchema.optional(),
  textureId: TextureIdSchema.optional(),
  createdByOperationId: OperationIdSchema.optional()
}).strict();
export type BinaryAssetEntryDto = z.infer<typeof BinaryAssetEntrySchema>;

export const BinaryAssetIndexFileSchema = z.object({
  schemaVersion: z.literal("binary-asset-index-v1"),
  assets: z.array(BinaryAssetEntrySchema)
}).strict();
export type BinaryAssetIndexFileDto = z.infer<typeof BinaryAssetIndexFileSchema>;
