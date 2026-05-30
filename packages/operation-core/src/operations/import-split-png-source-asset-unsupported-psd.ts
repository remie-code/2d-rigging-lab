import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { OperationId } from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "../operation-request.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createRejectedOperationResult
} from "../preconditions.js";

export const unsupportedPsdSourceAssetOperationHandler: OperationHandler = {
  operationType: "importPsdSourceAsset",

  dryRun(session, request, operationId) {
    return rejectUnsupportedPsdSourceAsset(session, request, operationId);
  },

  commit(session, request, operationId) {
    return rejectUnsupportedPsdSourceAsset(session, request, operationId);
  }
};

const rejectUnsupportedPsdSourceAsset = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId
): OperationApplyOutcome => ({
  result: createRejectedOperationResult({
    operationId,
    diagnostics: [
      createOperationDiagnostic({
        checkId: "operation.importPsdSourceAsset.unsupported",
        message: `PSD source asset import is not implemented in Wave 18 operation foundation: ${request.operationType}.`,
        target: { kind: "operation", id: operationId }
      })
    ]
  }),
  targetIds: [],
  candidateSession: session
});
