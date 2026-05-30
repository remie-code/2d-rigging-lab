import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { OperationId } from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "./operation-request.js";
import type { OperationResultDto } from "./operation-result.js";
import type { OperationType } from "./operation-type.js";
import { addKeyformOperationHandler } from "./operations/add-keyform.js";
import { addKeyformGrid2dOperationHandler } from "./operations/add-keyform-grid2d.js";
import { createDrawableOperationHandler } from "./operations/create-drawable.js";
import { createParameterOperationHandler } from "./operations/create-parameter.js";
import { generateMeshOperationHandler } from "./operations/generate-mesh.js";
import { setDrawOrderOperationHandler } from "./operations/set-draw-order.js";
import { setRuntimeVisibilityOperationHandler } from "./operations/set-runtime-visibility.js";

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
  [createDrawableOperationHandler.operationType, createDrawableOperationHandler],
  [generateMeshOperationHandler.operationType, generateMeshOperationHandler],
  [createParameterOperationHandler.operationType, createParameterOperationHandler],
  [addKeyformOperationHandler.operationType, addKeyformOperationHandler],
  [addKeyformGrid2dOperationHandler.operationType, addKeyformGrid2dOperationHandler],
  [setDrawOrderOperationHandler.operationType, setDrawOrderOperationHandler],
  [setRuntimeVisibilityOperationHandler.operationType, setRuntimeVisibilityOperationHandler]
]);

export const getOperationHandler = (operationType: OperationType): OperationHandler | undefined =>
  operationHandlers.get(operationType);
