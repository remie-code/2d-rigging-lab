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
import { PsdLayerMaterializationBatchOperationEvidenceDtoSchema } from "./psd-layer-materialization-batch-operation-evidence.js";
import { PsdLayerMaterializationOperationEvidenceDtoSchema } from "./psd-layer-materialization-operation-evidence.js";
import { PsdImportOperationEvidenceDtoSchema } from "./psd-import-operation-evidence.js";

export const OperationEvidenceResultSchema = z.object({
  runtimeDiff: RuntimeDiffSchema.optional(),
  validationDiff: ValidationDiffSchema.optional(),
  generatedRuntimeSnapshotIds: z.array(RuntimeSnapshotIdSchema).default([]),
  generatedRuntimeStateRefs: z.array(RuntimeStateArtifactRefSchema).default([]),
  generatedRuntimeStateSequenceRefs: z.array(RuntimeStateSequenceArtifactRefSchema).default([]),
  finalRuntimeState: RuntimeStateDtoSchema.optional(),
  finalRuntimeStateRef: RuntimeStateArtifactRefSchema.optional(),
  generatedValidationReportIds: z.array(ValidationReportIdSchema).default([]),
  meshTopologyEvidence: z.array(MeshTopologyOperationEvidenceDtoSchema).optional(),
  psdImportEvidence: z.array(PsdImportOperationEvidenceDtoSchema).optional(),
  psdLayerMaterializationEvidence: z.array(PsdLayerMaterializationOperationEvidenceDtoSchema).optional(),
  psdLayerMaterializationBatchEvidence: z
    .array(PsdLayerMaterializationBatchOperationEvidenceDtoSchema)
    .optional()
});
export type OperationEvidenceResultInput = z.input<typeof OperationEvidenceResultSchema>;
export type OperationEvidenceResultDto = z.infer<typeof OperationEvidenceResultSchema>;
