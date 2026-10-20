import {
  cloneAuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type { OperationEvidenceProviderLike } from "../operation-evidence-provider.js";
import { getOperationHandler } from "../operation-registry.js";
import type { OperationResultDto } from "../operation-result.js";
import { incrementCommittedPackageRevision } from "../package-revision.js";
import {
  createOperationDiagnostic,
  createRejectedOperationResult,
  prepareOperationRequest
} from "../preconditions.js";
import { applyOperationEvidence } from "./evidence.js";

export interface CommitOperationOptions {
  readonly evidenceProvider?: OperationEvidenceProviderLike;
}

export interface CommitOperationOutcome {
  readonly result: OperationResultDto;
}

export const commitOperation = (
  session: AuthoringSession,
  requestInput: unknown,
  options: CommitOperationOptions = {}
): CommitOperationOutcome => {
  const prepared = prepareOperationRequest(session, requestInput, false);

  if ("status" in prepared) {
    return { result: prepared };
  }

  const handler = getOperationHandler(prepared.request.operationType);
  if (handler === undefined) {
    return { result: createUnsupportedOperationResult(prepared.operationId, prepared.request.operationType) };
  }

  const baselineSession =
    options.evidenceProvider === undefined ? undefined : cloneAuthoringSession(session);
  const applied = handler.commit(session, prepared.request, prepared.operationId);
  if (applied.result.status !== "committed") {
    return { result: applied.result };
  }

  incrementCommittedPackageRevision(session, prepared.request.basePackageRevision);
  return {
    result: applyOperationEvidence({
      ...(options.evidenceProvider === undefined
        ? {}
        : { provider: options.evidenceProvider }),
      lifecycle: "commit",
      baselineSession: baselineSession ?? session,
      candidateSession: applied.candidateSession,
      request: prepared.request,
      result: applied.result,
      targetIds: applied.targetIds
    })
  };
};

export const commitOperationAsync = async (
  session: AuthoringSession,
  requestInput: unknown,
  options: CommitOperationOptions = {}
): Promise<CommitOperationOutcome> => {
  const prepared = prepareOperationRequest(session, requestInput, false);

  if ("status" in prepared) {
    return { result: prepared };
  }

  const handler = getOperationHandler(prepared.request.operationType);
  if (handler === undefined) {
    return { result: createUnsupportedOperationResult(prepared.operationId, prepared.request.operationType) };
  }

  const baselineSession =
    options.evidenceProvider === undefined ? undefined : cloneAuthoringSession(session);
  const applied = handler.commitAsync === undefined
    ? handler.commit(session, prepared.request, prepared.operationId)
    : await handler.commitAsync(session, prepared.request, prepared.operationId);
  if (applied.result.status !== "committed") {
    return { result: applied.result };
  }

  incrementCommittedPackageRevision(session, prepared.request.basePackageRevision);
  return {
    result: applyOperationEvidence({
      ...(options.evidenceProvider === undefined
        ? {}
        : { provider: options.evidenceProvider }),
      lifecycle: "commit",
      baselineSession: baselineSession ?? session,
      candidateSession: applied.candidateSession,
      request: prepared.request,
      result: applied.result,
      targetIds: applied.targetIds
    })
  };
};

const createUnsupportedOperationResult = (
  operationId: OperationResultDto["operationId"],
  operationType: string
): OperationResultDto =>
  createRejectedOperationResult({
    operationId,
    diagnostics: [
      createOperationDiagnostic({
        checkId: "operation.lifecycle.unsupportedOperation",
        message: `Operation is not supported by the Wave 3 lifecycle foundation: ${operationType}.`,
        target: { kind: "operation", id: operationId }
      })
    ]
  });
