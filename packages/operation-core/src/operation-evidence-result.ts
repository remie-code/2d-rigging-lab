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

import { MeshTopologyOperationEvidenceDtoSchema } from "./mesh-topology-evidence.js";

export const OperationEvidenceResultSchema = z.object({
  runtimeDiff: RuntimeDiffSchema.optional(),
  validationDiff: ValidationDiffSchema.optional(),
  generatedRuntimeSnapshotIds: z.array(RuntimeSnapshotIdSchema).default([]),
  generatedRuntimeStateRefs: z.array(RuntimeStateArtifactRefSchema).default([]),
  generatedRuntimeStateSequenceRefs: z.array(RuntimeStateSequenceArtifactRefSchema).default([]),
  finalRuntimeState: RuntimeStateDtoSchema.optional(),
  finalRuntimeStateRef: RuntimeStateArtifactRefSchema.optional(),
  generatedValidationReportIds: z.array(ValidationReportIdSchema).default([]),
  meshTopologyEvidence: z.array(MeshTopologyOperationEvidenceDtoSchema).optional()
});
export type OperationEvidenceResultInput = z.input<typeof OperationEvidenceResultSchema>;
export type OperationEvidenceResultDto = z.infer<typeof OperationEvidenceResultSchema>;
