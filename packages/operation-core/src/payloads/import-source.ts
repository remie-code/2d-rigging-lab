import { PartIdSchema, SourceAssetIdSchema } from "@private-2d-rigging-lab/contracts";
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

export const SplitPngSourceAssetPayloadSchema = z.object({
  sourceAssetId: SourceAssetIdSchema.optional(),
  manifestPath: z.string().min(1),
  importProfile: z.literal("split-png-fallback-v1"),
  defaultPartId: PartIdSchema.optional(),
  placementPolicy: z.enum(["use-metadata", "origin-with-warning"])
});
export type SplitPngSourceAssetPayloadDto = z.infer<typeof SplitPngSourceAssetPayloadSchema>;
