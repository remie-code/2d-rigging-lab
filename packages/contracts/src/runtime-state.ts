import { z } from "zod";

import { DynamicsGroupIdSchema, PackageIdSchema } from "./ids.js";

export const RuntimeDynamicsGroupStateSchema = z.object({
  angle: z.number().finite(),
  angularVelocity: z.number().finite(),
  previousSource: z.number().finite(),
  previousSourceVelocity: z.number().finite(),
  tick: z.number().int().nonnegative(),
  resetCounter: z.number().int().nonnegative()
});
export type RuntimeDynamicsGroupState = z.infer<typeof RuntimeDynamicsGroupStateSchema>;

export const RuntimeStateDtoSchema = z.object({
  schemaVersion: z.literal("runtime-state-v1"),
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional(),
  frameIndex: z.number().int().nonnegative(),
  fixedStepMs: z.number().positive(),
  accumulatorMs: z.number().nonnegative(),
  dynamicsGroups: z.record(DynamicsGroupIdSchema, RuntimeDynamicsGroupStateSchema)
});
export type RuntimeStateDto = z.infer<typeof RuntimeStateDtoSchema>;
