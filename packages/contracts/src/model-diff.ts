import { z } from "zod";

import { OperationIdSchema } from "./ids.js";
import { FieldChangeSchema } from "./field-change.js";
import { TargetRefSchema } from "./target-ref.js";

export const ModelDiffSchema = z.object({
  schemaVersion: z.literal("model-diff-v1"),
  baseRevision: z.number().int().nonnegative(),
  candidateRevision: z.number().int().nonnegative(),
  added: z.array(TargetRefSchema).default([]),
  removed: z.array(TargetRefSchema).default([]),
  changed: z
    .array(
      z.object({
        target: TargetRefSchema,
        fields: z.array(FieldChangeSchema)
      })
    )
    .default([]),
  operationIds: z.array(OperationIdSchema).default([])
});
export type ModelDiffDto = z.infer<typeof ModelDiffSchema>;
export const ModelDiffDtoSchema = ModelDiffSchema;
