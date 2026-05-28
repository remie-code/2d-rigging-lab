import {
  PackageIdSchema,
  ParameterIdSchema,
  RuntimeResetReasonSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const RuntimeInitialStateRequestSchema = z.object({
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional(),
  frameIndex: z.number().int().nonnegative().default(0),
  fixedStepMs: z.number().positive().default(16.6666667),
  authoredParameterValues: z.record(ParameterIdSchema, z.number().finite()).default({}),
  resetReasons: z.array(RuntimeResetReasonSchema).min(1)
});
export type RuntimeInitialStateRequestInput = z.input<typeof RuntimeInitialStateRequestSchema>;
export type RuntimeInitialStateRequestDto = z.infer<typeof RuntimeInitialStateRequestSchema>;

export const RuntimeEvaluationInputSchema = z.object({
  schemaVersion: z.literal("runtime-evaluation-input-v1"),
  frameIndex: z.number().int().nonnegative(),
  deltaTimeMs: z.number().finite().nonnegative(),
  resetReasons: z.array(RuntimeResetReasonSchema).default([]),
  authoredParameterValues: z.record(ParameterIdSchema, z.number().finite()).default({}),
  targetIds: z.array(z.string()).default([])
});
export type RuntimeEvaluationInputInput = z.input<typeof RuntimeEvaluationInputSchema>;
export type RuntimeEvaluationInputDto = z.infer<typeof RuntimeEvaluationInputSchema>;
