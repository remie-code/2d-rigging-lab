import { OperationIdSchema, SurfaceSchema } from "@private-2d-rigging-lab/contracts";
import { OperationRequestSchema } from "@private-2d-rigging-lab/operation-core";
import { z } from "zod";

export const GetEditorStatePayloadSchema = z.object({
  detail: z.enum(["summary", "full"]).default("summary")
});
export type GetEditorStatePayload = z.infer<typeof GetEditorStatePayloadSchema>;

export const DryRunOperationPayloadSchema = OperationRequestSchema.refine(
  (request) => request.dryRun === true,
  "dryRunOperation requires operation dryRun=true"
);
export type DryRunOperationPayload = z.infer<typeof DryRunOperationPayloadSchema>;

export const CommitOperationPayloadSchema = z.object({
  approvedDryRunCommandId: z.string().min(1),
  operation: OperationRequestSchema.refine(
    (request) => request.dryRun === false,
    "commitOperation requires operation dryRun=false"
  )
});
export type CommitOperationPayload = z.infer<typeof CommitOperationPayloadSchema>;

export const GetOperationLogPayloadSchema = z.object({
  operationIds: z.array(OperationIdSchema).optional(),
  targetIds: z.array(z.string().min(1)).optional(),
  surface: SurfaceSchema.optional()
});
export type GetOperationLogPayload = z.infer<typeof GetOperationLogPayloadSchema>;

export const AiCommandPayloadSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("getEditorState"),
    payload: GetEditorStatePayloadSchema
  }),
  z.object({
    command: z.literal("dryRunOperation"),
    payload: DryRunOperationPayloadSchema
  }),
  z.object({
    command: z.literal("commitOperation"),
    payload: CommitOperationPayloadSchema
  }),
  z.object({
    command: z.literal("getOperationLog"),
    payload: GetOperationLogPayloadSchema
  })
]);
export type AiCommandPayload = z.infer<typeof AiCommandPayloadSchema>;
