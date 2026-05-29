import {
  RuntimeDiffSchema,
  RuntimeSnapshotIdSchema,
  RuntimeStateArtifactRefSchema,
  RuntimeStateDtoSchema,
  RuntimeStateSequenceArtifactRefSchema,
  ValidationDiffSchema,
  ValidationReportIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const OperationEvidenceResultSchema = z.object({
  runtimeDiff: RuntimeDiffSchema.optional(),
  validationDiff: ValidationDiffSchema.optional(),
  generatedRuntimeSnapshotIds: z.array(RuntimeSnapshotIdSchema).default([]),
  generatedRuntimeStateRefs: z.array(RuntimeStateArtifactRefSchema).default([]),
  generatedRuntimeStateSequenceRefs: z.array(RuntimeStateSequenceArtifactRefSchema).default([]),
  finalRuntimeState: RuntimeStateDtoSchema.optional(),
  finalRuntimeStateRef: RuntimeStateArtifactRefSchema.optional(),
  generatedValidationReportIds: z.array(ValidationReportIdSchema).default([])
});
export type OperationEvidenceResultInput = z.input<typeof OperationEvidenceResultSchema>;
export type OperationEvidenceResultDto = z.infer<typeof OperationEvidenceResultSchema>;
