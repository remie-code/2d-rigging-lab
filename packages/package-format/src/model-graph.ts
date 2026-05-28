import { z } from "zod";

import {
  DrawableIdSchema,
  PartIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";

export const ModelPartSchema = z.object({
  partId: PartIdSchema,
  displayName: z.string(),
  parentPartId: PartIdSchema.optional(),
  childPartIds: z.array(PartIdSchema).default([]),
  drawableIds: z.array(DrawableIdSchema).default([])
});
export type ModelPartDto = z.infer<typeof ModelPartSchema>;

export const ModelGraphSchema = z.object({
  schemaVersion: z.literal("model-graph-v1"),
  coordinateSystem: z.literal("canvas-y-down-v1"),
  canvasSize: z.object({
    width: z.number().positive(),
    height: z.number().positive()
  }),
  parts: z.array(ModelPartSchema),
  rigControlRootIds: z.array(RigControlIdSchema).default([]),
  stableOrder: z.array(z.string())
});
export type ModelGraphDto = z.infer<typeof ModelGraphSchema>;
