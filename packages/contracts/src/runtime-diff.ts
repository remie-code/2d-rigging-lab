import { z } from "zod";

import { DiagnosticSchema } from "./diagnostics.js";
import { FieldChangeSchema } from "./field-change.js";
import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  ParameterIdSchema,
  RuntimeSnapshotIdSchema
} from "./ids.js";

export const RuntimeDiffSchema = z.object({
  schemaVersion: z.literal("runtime-diff-v1"),
  beforeSnapshotId: RuntimeSnapshotIdSchema,
  afterSnapshotId: RuntimeSnapshotIdSchema,
  parameterChanges: z.array(FieldChangeSchema).default([]),
  dynamicsChanges: z
    .array(
      z.object({
        dynamicsGroupId: DynamicsGroupIdSchema,
        outputParameterId: ParameterIdSchema.optional(),
        stateChanged: z.boolean(),
        outputChanged: z.boolean(),
        positionBefore: z.number().finite().optional(),
        positionAfter: z.number().finite().optional(),
        velocityBefore: z.number().finite().optional(),
        velocityAfter: z.number().finite().optional(),
        tickBefore: z.number().int().nonnegative().optional(),
        tickAfter: z.number().int().nonnegative().optional(),
        resetCounterBefore: z.number().int().nonnegative().optional(),
        resetCounterAfter: z.number().int().nonnegative().optional()
      })
    )
    .default([]),
  drawableChanges: z
    .array(
      z.object({
        drawableId: DrawableIdSchema,
        boundsChanged: z.boolean(),
        vertexHashBefore: z.string().optional(),
        vertexHashAfter: z.string().optional(),
        fullVertexDeltaRef: z.string().optional()
      })
    )
    .default([]),
  diagnosticDelta: z.array(DiagnosticSchema).default([])
});
export type RuntimeDiffDto = z.infer<typeof RuntimeDiffSchema>;
export const RuntimeDiffDtoSchema = RuntimeDiffSchema;
