import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  moveDrawableRigControlBinding
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

type MoveDrawableRigControlBindingRequest = Extract<
  OperationRequestDto,
  { operationType: "moveDrawableRigControlBinding" }
>;
type MoveDrawableRigControlBindingMutation = ReturnType<typeof moveDrawableRigControlBinding>;

export const moveDrawableRigControlBindingOperationHandler: OperationHandler = {
  operationType: "moveDrawableRigControlBinding",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyMoveDrawableRigControlBinding(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyMoveDrawableRigControlBinding(session, request, operationId, "committed");
  }
};

const applyMoveDrawableRigControlBinding = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "moveDrawableRigControlBinding") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.moveDrawableRigControlBinding.unsupportedPayload",
            message: `moveDrawableRigControlBinding handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const fallbackTargetIds = [request.payload.drawableId, request.payload.targetRigControlId];

  try {
    const mutation = moveDrawableRigControlBinding(session, {
      drawableId: request.payload.drawableId,
      targetRigControlId: request.payload.targetRigControlId
    });

    return {
      result: createMoveDrawableRigControlBindingResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        mutation
      }),
      targetIds: [
        mutation.drawableId,
        mutation.sourceRigControlAfter.rigControlId,
        mutation.targetRigControlAfter.rigControlId
      ],
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createMoveDrawableRigControlBindingMutationDiagnostic(error, request)]
      }),
      targetIds: fallbackTargetIds,
      candidateSession: session
    };
  }
};

const createMoveDrawableRigControlBindingResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: MoveDrawableRigControlBindingMutation;
}): OperationResultDto => {
  const sourceTarget: TargetRefDto = {
    kind: "rigControl",
    id: input.mutation.sourceRigControlAfter.rigControlId
  };
  const targetTarget: TargetRefDto = {
    kind: "rigControl",
    id: input.mutation.targetRigControlAfter.rigControlId
  };
  const drawableTarget: TargetRefDto = {
    kind: "drawable",
    id: input.mutation.drawableId,
    path: `/model/rigControls/rigControls/${input.mutation.targetRigControlAfter.rigControlId}/childDrawableIds`
  };
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: sourceTarget,
        fields: [
          {
            path: `/model/rigControls/rigControls/${input.mutation.sourceRigControlAfter.rigControlId}/childDrawableIds`,
            before: [...input.mutation.sourceRigControlBefore.childDrawableIds],
            after: [...input.mutation.sourceRigControlAfter.childDrawableIds]
          }
        ]
      },
      {
        target: targetTarget,
        fields: [
          {
            path: `/model/rigControls/rigControls/${input.mutation.targetRigControlAfter.rigControlId}/childDrawableIds`,
            before: [...input.mutation.targetRigControlBefore.childDrawableIds],
            after: [...input.mutation.targetRigControlAfter.childDrawableIds]
          }
        ]
      }
    ],
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], [sourceTarget, targetTarget, drawableTarget]),
    modelDiff,
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    reversible: true
  });
};

const createMoveDrawableRigControlBindingMutationDiagnostic = (
  error: AuthoringMutationError,
  request: MoveDrawableRigControlBindingRequest
): DiagnosticDto => {
  switch (error.code) {
    case "missing_drawable":
      return createOperationDiagnostic({
        checkId: "operation.moveDrawableRigControlBinding.missingDrawable",
        message: error.message,
        target: { kind: "drawable", id: request.payload.drawableId }
      });
    case "missing_rig_control":
      return createOperationDiagnostic({
        checkId: "operation.moveDrawableRigControlBinding.missingTargetRigControl",
        message: error.message,
        target: { kind: "rigControl", id: request.payload.targetRigControlId }
      });
    case "missing_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.moveDrawableRigControlBinding.missingSourceBinding",
        message: error.message,
        target: { kind: "drawable", id: request.payload.drawableId }
      });
    case "duplicate_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.moveDrawableRigControlBinding.duplicateBinding",
        message: error.message,
        target: { kind: "drawable", id: request.payload.drawableId }
      });
    case "no_op_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.moveDrawableRigControlBinding.noOp",
        message: error.message,
        target: { kind: "drawable", id: request.payload.drawableId },
        severity: "warning"
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.moveDrawableRigControlBinding.authoringMutationFailed",
        message: error.message,
        target: { kind: "drawable", id: request.payload.drawableId }
      });
  }
};
