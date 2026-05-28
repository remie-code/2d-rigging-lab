import { z } from "zod";

import { OperationIdSchema, ProvenanceIdSchema } from "@private-2d-rigging-lab/contracts";

export const ProvenanceRecordSchema = z.object({
  provenanceId: ProvenanceIdSchema,
  assetId: z.string(),
  assetKind: z.enum(["source", "texture", "thumbnail", "generatedFixture", "aiEdit"]),
  filePath: z.string(),
  contentHash: z.string().optional(),
  creator: z.string(),
  sourceUrl: z.string().optional(),
  license: z.string(),
  redistributionAllowed: z.boolean(),
  aiUsed: z.boolean(),
  transformHistory: z.array(z.string()).default([]),
  relatedOperationIds: z.array(OperationIdSchema).default([])
});
export type ProvenanceRecordDto = z.infer<typeof ProvenanceRecordSchema>;

export const RightsRecordSchema = z.object({
  assetId: z.string(),
  rightsStatus: z.enum(["cleared", "needs_review", "blocked"]),
  license: z.string(),
  redistributionAllowed: z.boolean(),
  notes: z.string().optional()
});
export type RightsRecordDto = z.infer<typeof RightsRecordSchema>;

export const ProvenanceFileSchema = z.object({
  schemaVersion: z.literal("provenance-file-v1"),
  records: z.array(ProvenanceRecordSchema)
});
export type ProvenanceFileDto = z.infer<typeof ProvenanceFileSchema>;

export const RightsFileSchema = z.object({
  schemaVersion: z.literal("rights-file-v1"),
  records: z.array(RightsRecordSchema)
});
export type RightsFileDto = z.infer<typeof RightsFileSchema>;
