import { SnapshotDetailSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const EpsilonPolicySchema = z.object({
  vertexPositionEpsilon: z.number().positive().default(0.0001),
  boundsEpsilon: z.number().positive().default(0.0001),
  opacityEpsilon: z.number().positive().default(0.000001),
  hashPrecisionDecimals: z.number().int().min(3).max(8).default(5)
});
export type EpsilonPolicyInput = z.input<typeof EpsilonPolicySchema>;
export type EpsilonPolicyDto = z.infer<typeof EpsilonPolicySchema>;

export const RuntimeEvaluationOptionsSchema = z.object({
  schemaVersion: z.literal("runtime-evaluation-options-v1"),
  snapshotDetail: SnapshotDetailSchema.default("summary"),
  evaluatorVersions: z
    .object({
      dynamics: z.literal("additivePendulumV0"),
      keyform1d: z.literal("linear-1d-v1"),
      keyformGrid2d: z.literal("parameter-grid-2d-v1"),
      warpLattice: z.literal("bilinear-grid-v1"),
      rigControlHierarchy: z.literal("parent-before-child-v1")
    })
    .default({
      dynamics: "additivePendulumV0",
      keyform1d: "linear-1d-v1",
      keyformGrid2d: "parameter-grid-2d-v1",
      warpLattice: "bilinear-grid-v1",
      rigControlHierarchy: "parent-before-child-v1"
    }),
  epsilonPolicy: EpsilonPolicySchema.default(EpsilonPolicySchema.parse({})),
  includeTrace: z.boolean().default(false),
  maxSubSteps: z.number().int().min(1).max(16).default(4)
});
export type RuntimeEvaluationOptionsInput = z.input<typeof RuntimeEvaluationOptionsSchema>;
export type RuntimeEvaluationOptionsDto = z.infer<typeof RuntimeEvaluationOptionsSchema>;

export const defaultRuntimeEvaluationOptions = (): RuntimeEvaluationOptionsDto =>
  RuntimeEvaluationOptionsSchema.parse({
    schemaVersion: "runtime-evaluation-options-v1"
  });
