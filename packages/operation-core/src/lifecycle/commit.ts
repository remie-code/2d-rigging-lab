import {
  cloneAuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type { OperationEvidenceProviderLike } from "../operation-evidence-provider.js";
import { createOperationLog, createOperationLogEntry } from "../operation-log.js";
import type { OperationLog } from "../operation-log.js";
import { getOperationHandler } from "../operation-registry.js";
import type { OperationLogEntryDto } from "../operation-log-entry.js";
import type { OperationResultDto } from "../operation-result.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult,
  prepareOperationRequest
} from "../preconditions.js";
import { applyOperationEvidence } from "./evidence.js";

export interface CommitOperationOptions {
  readonly operationLog?: OperationLog;
  readonly now?: () => Date;
  readonly evidenceProvider?: OperationEvidenceProviderLike;
}

export interface CommitOperationOutcome {
  readonly result: OperationResultDto;
  readonly logEntry?: OperationLogEntryDto;
  readonly operationLogLength: number;
}

export const commitOperation = (
  session: AuthoringSession,
  requestInput: unknown,
  options: CommitOperationOptions = {}
): CommitOperationOutcome => {
  const operationLog = options.operationLog ?? createOperationLog();
  const prepared = prepareOperationRequest(session, requestInput, false);

  if ("status" in prepared) {
    return {
      result: prepared,
      operationLogLength: operationLog.entries.length
    };
  }

  const handler = getOperationHandler(prepared.request.operationType);
  if (handler === undefined) {
    return {
      result: createRejectedOperationResult({
        operationId: prepared.operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.lifecycle.unsupportedOperation",
            message: `Operation is not supported by the Wave 3 lifecycle foundation: ${prepared.request.operationType}.`,
            target: { kind: "operation", id: prepared.operationId }
          })
        ]
      }),
      operationLogLength: operationLog.entries.length
    };
  }

  const baselineSession =
    options.evidenceProvider === undefined ? undefined : cloneAuthoringSession(session);
  const applied = handler.commit(session, prepared.request, prepared.operationId);
  if (applied.result.status !== "committed") {
    return {
      result: applied.result,
      operationLogLength: operationLog.entries.length
    };
  }
  const result = applyOperationEvidence({
    ...(options.evidenceProvider === undefined
      ? {}
      : { provider: options.evidenceProvider }),
    lifecycle: "commit",
    baselineSession: baselineSession ?? session,
    candidateSession: applied.candidateSession,
    request: prepared.request,
    result: applied.result,
    targetIds: applied.targetIds
  });

  const logEntry = createOperationLogEntry({
    request: prepared.request,
    result,
    targetIds: applied.targetIds,
    precondition: createPreconditionResult(
      applied.result.precondition.diagnostics,
      applied.targetIds.map((id) => ({ kind: "parameter", id }))
    ),
    timestamp: options.now?.() ?? new Date()
  });
  const operationLogLength = operationLog.append(logEntry);

  return {
    result,
    logEntry,
    operationLogLength
  };
};
