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

import { MeshTopologyOperationEvidenceDtoSchema } from "./mesh-topology-evidence.js";
import { OperationPreconditionResultSchema } from "./operation-precondition.js";
import { PsdLayerMaterializationBatchOperationEvidenceDtoSchema } from "./psd-layer-materialization-batch-operation-evidence.js";
import { PsdLayerMaterializationOperationEvidenceDtoSchema } from "./psd-layer-materialization-operation-evidence.js";
import { PsdImportOperationEvidenceDtoSchema } from "./psd-import-operation-evidence.js";

export const OperationResultPreconditionSchema = OperationPreconditionResultSchema;
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
  meshTopologyEvidence: z.array(MeshTopologyOperationEvidenceDtoSchema).optional(),
  psdImportEvidence: z.array(PsdImportOperationEvidenceDtoSchema).optional(),
  psdLayerMaterializationEvidence: z.array(PsdLayerMaterializationOperationEvidenceDtoSchema).optional(),
  psdLayerMaterializationBatchEvidence: z
    .array(PsdLayerMaterializationBatchOperationEvidenceDtoSchema)
    .optional(),
  reversible: z.boolean()
});
export type OperationResultDto = z.infer<typeof OperationResultSchema>;
