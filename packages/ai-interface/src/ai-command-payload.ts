import { OperationIdSchema, SurfaceSchema } from "@private-2d-rigging-lab/contracts";
import { OperationRequestSchema } from "@private-2d-rigging-lab/operation-core";
import { z } from "zod";

import {
  InspectModelPayloadSchema,
  InspectTargetPayloadSchema
} from "./ai-inspection-command.js";
import { InspectEvaluatedGeometryPayloadSchema } from "./ai-measurement-command.js";
import {
  ExecutePsdImportPlanIntakePayloadSchema,
  GetPsdImportPlanStatePayloadSchema,
  PreflightPsdImportPlanIntakePayloadSchema,
  SetPsdImportPlanApprovalPayloadSchema
} from "./ai-psd-import-plan-command.js";
import { RenderViewPayloadSchema } from "./ai-render-view-command.js";
import { ValidatePackagePayloadSchema } from "./ai-validation-command.js";

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
    command: z.literal("inspectModel"),
    payload: InspectModelPayloadSchema
  }),
  z.object({
    command: z.literal("inspectTarget"),
    payload: InspectTargetPayloadSchema
  }),
  z.object({
    command: z.literal("inspectEvaluatedGeometry"),
    payload: InspectEvaluatedGeometryPayloadSchema
  }),
  z.object({
    command: z.literal("validatePackage"),
    payload: ValidatePackagePayloadSchema
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
  }),
  z.object({
    command: z.literal("renderView"),
    payload: RenderViewPayloadSchema
  }),
  z.object({
    command: z.literal("getPsdImportPlanState"),
    payload: GetPsdImportPlanStatePayloadSchema
  }),
  z.object({
    command: z.literal("setPsdImportPlanApproval"),
    payload: SetPsdImportPlanApprovalPayloadSchema
  }),
  z.object({
    command: z.literal("preflightPsdImportPlanIntake"),
    payload: PreflightPsdImportPlanIntakePayloadSchema
  }),
  z.object({
    command: z.literal("executePsdImportPlanIntake"),
    payload: ExecutePsdImportPlanIntakePayloadSchema
  })
]);
export type AiCommandPayload = z.infer<typeof AiCommandPayloadSchema>;
