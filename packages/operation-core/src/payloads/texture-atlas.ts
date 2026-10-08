import {
  TextureAtlasLayoutSettingsSchema,
  TextureAtlasLayoutSummarySchema
} from "@private-2d-rigging-lab/authoring-core";
import { PartIdSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

const LockedTargetIdsSchema = z.array(z.string().min(1)).default([]);

export const ApplyTextureAtlasPreviewPayloadSchema = z.object({
  settings: TextureAtlasLayoutSettingsSchema,
  editorHiddenPartIds: z.array(PartIdSchema).default([]),
  expectedLayoutSummary: TextureAtlasLayoutSummarySchema,
  lockedTargetIds: LockedTargetIdsSchema
});
export type ApplyTextureAtlasPreviewPayloadDto = z.infer<
  typeof ApplyTextureAtlasPreviewPayloadSchema
>;
