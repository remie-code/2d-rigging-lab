import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import type { OperationEvidenceProviderLike } from "../operation-evidence-provider.js";
import { getOperationHandler } from "../operation-registry.js";
import type { OperationResultDto } from "../operation-result.js";
import { applyDryRunCandidatePackageRevision } from "../package-revision.js";
import {
  createOperationDiagnostic,
  createRejectedOperationResult,
  prepareOperationRequest
} from "../preconditions.js";
import { applyOperationEvidence } from "./evidence.js";

export interface DryRunOperationOptions {
  readonly evidenceProvider?: OperationEvidenceProviderLike;
}

export const dryRunOperation = (
  session: AuthoringSession,
  requestInput: unknown,
  options: DryRunOperationOptions = {}
): OperationResultDto => {
  const prepared = prepareOperationRequest(session, requestInput, true);
  if ("status" in prepared) {
    return prepared;
  }

  const handler = getOperationHandler(prepared.request.operationType);
  if (handler === undefined) {
    return createRejectedOperationResult({
      operationId: prepared.operationId,
      diagnostics: [
        createOperationDiagnostic({
          checkId: "operation.lifecycle.unsupportedOperation",
          message: `Operation is not supported by the Wave 3 lifecycle foundation: ${prepared.request.operationType}.`,
          target: { kind: "operation", id: prepared.operationId }
        })
      ]
    });
  }

  const applied = handler.dryRun(session, prepared.request, prepared.operationId);
  if (applied.result.status !== "dry_run") {
    return applied.result;
  }

  applyDryRunCandidatePackageRevision({
    baselineSession: session,
    candidateSession: applied.candidateSession,
    basePackageRevision: prepared.request.basePackageRevision
  });

  return applyOperationEvidence({
    ...(options.evidenceProvider === undefined
      ? {}
      : { provider: options.evidenceProvider }),
    lifecycle: "dry_run",
    baselineSession: session,
    candidateSession: applied.candidateSession,
    request: prepared.request,
    result: applied.result,
    targetIds: applied.targetIds
  });
};
