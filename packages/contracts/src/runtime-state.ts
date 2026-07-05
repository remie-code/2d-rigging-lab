import { z } from "zod";

import { DynamicsGroupIdSchema, PackageIdSchema } from "./ids.js";

// World-frame Verlet chain state. Each particle stores its current position (x, y) and its
// previous-step position (px, py). See discussion/design/dynamics-world-frame-chain.md §3.3 / §4.
export const RuntimeDynamicsParticleSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  px: z.number().finite(),
  py: z.number().finite()
});
export type RuntimeDynamicsParticle = z.infer<typeof RuntimeDynamicsParticleSchema>;

export const RuntimeDynamicsGroupStateSchema = z.object({
  particles: z.array(RuntimeDynamicsParticleSchema),
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
