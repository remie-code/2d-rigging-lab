import { z } from "zod";

import {
  RuntimeEvaluationStrictnessSchema,
  RuntimeResetReasonSchema,
  RuntimeSourceSurfaceSchema
} from "./enums.js";
import { PackageIdSchema, ParameterIdSchema } from "./ids.js";
import { RuntimeStateDtoSchema } from "./runtime-state.js";

export const RuntimeSequenceFrameSchema = z.object({
  frameIndex: z.number().int().nonnegative(),
  deltaTimeMs: z.number().finite().nonnegative(),
  resetReasons: z.array(RuntimeResetReasonSchema).default([]),
  authoredParameterValues: z.record(ParameterIdSchema, z.number().finite()).default({}),
  targetIds: z.array(z.string()).default([])
});
export type RuntimeSequenceFrameDto = z.infer<typeof RuntimeSequenceFrameSchema>;
export const RuntimeSequenceFrameDtoSchema = RuntimeSequenceFrameSchema;

export const RuntimeEvaluationContextSchema = z.object({
  source: z.object({
    surface: RuntimeSourceSurfaceSchema,
    operationId: z.string().optional()
  }),
  policy: z
    .object({
      strictness: RuntimeEvaluationStrictnessSchema.default("interactive")
    })
    .default({ strictness: "interactive" })
});
export type RuntimeEvaluationContextDto = z.infer<typeof RuntimeEvaluationContextSchema>;
export const RuntimeEvaluationContextDtoSchema = RuntimeEvaluationContextSchema;

export const RuntimeSequenceEvaluationContextSchema = RuntimeEvaluationContextSchema;
export type RuntimeSequenceEvaluationContextDto = RuntimeEvaluationContextDto;

export const RuntimeStateSequenceArtifactSchema = z.object({
  schemaVersion: z.literal("runtime-state-sequence-v1"),
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional(),
  fixedStepMs: z.number().positive(),
  frameCount: z.number().int().nonnegative(),
  inputFramesHash: z.string().optional(),
  runtimeEvaluationContext: RuntimeEvaluationContextSchema.optional(),
  evaluatorVersionSummary: z.record(z.string(), z.string()).optional(),
  states: z.array(RuntimeStateDtoSchema)
});
export type RuntimeStateSequenceArtifact = z.infer<typeof RuntimeStateSequenceArtifactSchema>;
export const RuntimeStateSequenceArtifactDtoSchema = RuntimeStateSequenceArtifactSchema;
export type RuntimeStateSequenceArtifactDto = RuntimeStateSequenceArtifact;
