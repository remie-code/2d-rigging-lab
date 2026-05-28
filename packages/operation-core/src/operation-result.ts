import {
  DiagnosticSchema,
  ModelDiffSchema,
  OperationIdSchema,
  RuntimeDiffSchema,
  RuntimeSnapshotIdSchema,
  RuntimeStateArtifactRefSchema,
  RuntimeStateDtoSchema,
  RuntimeStateSequenceArtifactRefSchema,
  ValidationDiffSchema,
  ValidationReportIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const OperationResultPreconditionSchema = z.object({
  ok: z.boolean(),
  diagnostics: z.array(DiagnosticSchema)
});
export type OperationResultPreconditionDto = z.infer<typeof OperationResultPreconditionSchema>;

export const OperationResultSchema = z.object({
  schemaVersion: z.literal("operation-result-v1"),
  operationId: OperationIdSchema,
  status: z.enum(["accepted", "rejected", "dry_run", "committed", "rolled_back"]),
  precondition: OperationResultPreconditionSchema,
  modelDiff: ModelDiffSchema.optional(),
  runtimeDiff: RuntimeDiffSchema.optional(),
  validationDiff: ValidationDiffSchema.optional(),
  diagnostics: z.array(DiagnosticSchema).default([]),
  generatedRuntimeSnapshotIds: z.array(RuntimeSnapshotIdSchema).default([]),
  generatedRuntimeStateRefs: z.array(RuntimeStateArtifactRefSchema).default([]),
  generatedRuntimeStateSequenceRefs: z.array(RuntimeStateSequenceArtifactRefSchema).default([]),
  finalRuntimeState: RuntimeStateDtoSchema.optional(),
  finalRuntimeStateRef: RuntimeStateArtifactRefSchema.optional(),
  generatedValidationReportIds: z.array(ValidationReportIdSchema).default([]),
  reversible: z.boolean()
});
export type OperationResultDto = z.infer<typeof OperationResultSchema>;
