import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

import { getOperationHandler } from "../operation-registry.js";
import type { OperationResultDto } from "../operation-result.js";
import {
  createOperationDiagnostic,
  createRejectedOperationResult,
  prepareOperationRequest
} from "../preconditions.js";

export const dryRunOperation = (
  session: AuthoringSession,
  requestInput: unknown
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

  return handler.dryRun(session, prepared.request, prepared.operationId).result;
};
