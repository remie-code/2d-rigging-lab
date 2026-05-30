import { z } from "zod";

import {
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

export const TextureAtlasEntrySchema = z.object({
  textureId: TextureIdSchema,
  filePath: z.string(),
  contentHash: z.string().optional(),
  sourceAssetId: SourceAssetIdSchema.optional(),
  sourceLayerId: z.string().optional(),
  provenanceId: ProvenanceIdSchema.optional()
});
export type TextureAtlasEntryDto = z.infer<typeof TextureAtlasEntrySchema>;

export const TextureAtlasFileSchema = z.object({
  schemaVersion: z.literal("texture-atlas-v1"),
  textures: z.array(TextureAtlasEntrySchema)
});
export type TextureAtlasFileDto = z.infer<typeof TextureAtlasFileSchema>;
