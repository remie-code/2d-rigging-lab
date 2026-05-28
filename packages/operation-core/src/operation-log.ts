import type { OperationLogEntryDto } from "./operation-log-entry.js";
import { OperationLogEntrySchema } from "./operation-log-entry.js";
import type { OperationRequestDto } from "./operation-request.js";
import type { OperationResultDto } from "./operation-result.js";
import { createProvenanceId, createTransactionId } from "./operation-ids.js";
import type { OperationPreconditionResultDto } from "./operation-precondition.js";

export interface OperationLog {
  readonly entries: readonly OperationLogEntryDto[];
  append(entry: OperationLogEntryDto): number;
}

export const createOperationLog = (): OperationLog => {
  const entries: OperationLogEntryDto[] = [];

  return {
    get entries() {
      return entries;
    },
    append(entry) {
      entries.push(entry);
      return entries.length;
    }
  };
};

export const createOperationLogEntry = (input: {
  readonly request: OperationRequestDto;
  readonly result: OperationResultDto;
  readonly targetIds: readonly string[];
  readonly precondition: OperationPreconditionResultDto;
  readonly timestamp: Date;
}): OperationLogEntryDto =>
  OperationLogEntrySchema.parse({
    schemaVersion: "operation-log-entry-v1",
    operationId: input.result.operationId,
    transactionId: createTransactionId(input.result.operationId),
    timestamp: input.timestamp.toISOString(),
    actor: input.request.actor,
    surface: input.request.surface,
    operationType: input.request.operationType,
    targetIds: [...input.targetIds],
    precondition: input.precondition,
    payload: {
      operationType: input.request.operationType,
      payload: input.request.payload
    },
    result: input.result,
    provenanceId: createProvenanceId(input.result.operationId),
    validationReportIds: input.result.generatedValidationReportIds,
    runtimeSnapshotIds: input.result.generatedRuntimeSnapshotIds,
    reversible: input.result.reversible
  });
