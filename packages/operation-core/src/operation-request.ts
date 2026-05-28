import { ActorSchema, OperationIdSchema, SurfaceSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import { OperationPayloadSchema } from "./operation-payload.js";

export const OperationTraceSchema = z
  .object({
    relatedAC: z.array(z.string()).default([]),
    relatedScenarios: z.array(z.string()).default([])
  })
  .default({ relatedAC: [], relatedScenarios: [] });
export type OperationTraceDto = z.infer<typeof OperationTraceSchema>;

export const OperationRequestBaseSchema = z.object({
  schemaVersion: z.literal("operation-request-v1"),
  operationId: OperationIdSchema.optional(),
  actor: ActorSchema,
  surface: SurfaceSchema,
  dryRun: z.boolean(),
  basePackageRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().optional(),
  trace: OperationTraceSchema
});
export type OperationRequestBaseDto = z.infer<typeof OperationRequestBaseSchema>;

export const OperationRequestSchema = z.intersection(OperationRequestBaseSchema, OperationPayloadSchema);
export type OperationRequestDto = z.infer<typeof OperationRequestSchema>;
