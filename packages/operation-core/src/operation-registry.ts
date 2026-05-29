import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { OperationId } from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "./operation-request.js";
import type { OperationResultDto } from "./operation-result.js";
import type { OperationType } from "./operation-type.js";
import { createParameterOperationHandler } from "./operations/create-parameter.js";

export interface OperationApplyOutcome {
  readonly result: OperationResultDto;
  readonly targetIds: readonly string[];
  readonly candidateSession: AuthoringSession;
}

export interface OperationHandler {
  readonly operationType: OperationType;
  dryRun(
    session: AuthoringSession,
    request: OperationRequestDto,
    operationId: OperationId
  ): OperationApplyOutcome;
  commit(
    session: AuthoringSession,
    request: OperationRequestDto,
    operationId: OperationId
  ): OperationApplyOutcome;
}

export const operationHandlers: ReadonlyMap<OperationType, OperationHandler> = new Map([
  [createParameterOperationHandler.operationType, createParameterOperationHandler]
]);

export const getOperationHandler = (operationType: OperationType): OperationHandler | undefined =>
  operationHandlers.get(operationType);
