import {
  cloneAuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { TargetRefDto } from "@private-2d-rigging-lab/contracts";

import type { OperationEvidenceProviderLike } from "../operation-evidence-provider.js";
import { createOperationLog, createOperationLogEntry } from "../operation-log.js";
import type { OperationLog } from "../operation-log.js";
import { getOperationHandler } from "../operation-registry.js";
import type { OperationLogEntryDto } from "../operation-log-entry.js";
import type { OperationResultDto } from "../operation-result.js";
import { incrementCommittedPackageRevision } from "../package-revision.js";
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

  incrementCommittedPackageRevision(session, prepared.request.basePackageRevision);
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
      result.precondition.diagnostics,
      getCommittedCheckedTargetRefs(result)
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

type ResultPreconditionWithCheckedTargets = OperationResultDto["precondition"] & {
  readonly checkedTargetRefs?: readonly TargetRefDto[];
};

const getCommittedCheckedTargetRefs = (result: OperationResultDto): readonly TargetRefDto[] => {
  const checkedTargetRefs = (result.precondition as ResultPreconditionWithCheckedTargets).checkedTargetRefs;

  if (checkedTargetRefs !== undefined) {
    return checkedTargetRefs;
  }

  return getModelDiffTargetRefs(result);
};

const getModelDiffTargetRefs = (result: OperationResultDto): readonly TargetRefDto[] => {
  if (result.modelDiff === undefined) {
    return [];
  }

  return uniqueTargetRefs([
    ...result.modelDiff.added,
    ...result.modelDiff.removed,
    ...result.modelDiff.changed.map((change) => change.target)
  ]);
};

const uniqueTargetRefs = (targetRefs: readonly TargetRefDto[]): readonly TargetRefDto[] => {
  const seen = new Set<string>();
  const unique: TargetRefDto[] = [];

  for (const targetRef of targetRefs) {
    const key = `${targetRef.kind}:${targetRef.id}:${targetRef.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(targetRef);
  }

  return unique;
};
