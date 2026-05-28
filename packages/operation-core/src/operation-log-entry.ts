import {
  ActorSchema,
  OperationIdSchema,
  ProvenanceIdSchema,
  RuntimeSnapshotIdSchema,
  SurfaceSchema,
  TransactionIdSchema,
  ValidationReportIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import { OperationPayloadSchema } from "./operation-payload.js";
import { OperationPreconditionResultSchema } from "./operation-precondition.js";
import { OperationResultSchema } from "./operation-result.js";
import { OperationTypeSchema } from "./operation-type.js";

export const OperationLogEntrySchema = z.object({
  schemaVersion: z.literal("operation-log-entry-v1"),
  operationId: OperationIdSchema,
  transactionId: TransactionIdSchema,
  timestamp: z.string().datetime(),
  actor: ActorSchema,
  surface: SurfaceSchema,
  operationType: OperationTypeSchema,
  targetIds: z.array(z.string()),
  precondition: OperationPreconditionResultSchema,
  payload: OperationPayloadSchema,
  result: OperationResultSchema,
  provenanceId: ProvenanceIdSchema,
  validationReportIds: z.array(ValidationReportIdSchema).default([]),
  runtimeSnapshotIds: z.array(RuntimeSnapshotIdSchema).default([]),
  reversible: z.boolean()
});
export type OperationLogEntryDto = z.infer<typeof OperationLogEntrySchema>;
