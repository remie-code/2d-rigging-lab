import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  getDrawableById,
  setDrawableRuntimeVisibility
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DrawableId,
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

export const setRuntimeVisibilityOperationHandler: OperationHandler = {
  operationType: "setRuntimeVisibility",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applySetRuntimeVisibility(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applySetRuntimeVisibility(session, request, operationId, "committed");
  }
};

const applySetRuntimeVisibility = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "setRuntimeVisibility") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.setRuntimeVisibility.unsupportedPayload",
            message: `setRuntimeVisibility handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const targetIds = [request.payload.target.id];
  const preconditionDiagnostics = evaluateSetRuntimeVisibilityPreconditions(session, request);
  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;

  try {
    const mutation = setDrawableRuntimeVisibility(session, {
      drawableId: request.payload.target.id as DrawableId,
      runtimeVisibility: request.payload.runtimeVisibility
    });
    const drawableTarget = createDrawableTarget(mutation.drawableAfter.drawableId);

    return {
      result: createSetRuntimeVisibilityResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        drawableTarget,
        before: mutation.drawableBefore.runtimeVisibility,
        after: mutation.drawableAfter.runtimeVisibility
      }),
      targetIds,
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    const diagnostic = createSetRuntimeVisibilityMutationDiagnostic(error, operationId);
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: [diagnostic] }),
      targetIds,
      candidateSession: session
    };
  }
};

const evaluateSetRuntimeVisibilityPreconditions = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "setRuntimeVisibility" }>
): DiagnosticDto[] => {
  const target = request.payload.target;
  if (target.kind !== "drawable") {
    return [
      createOperationDiagnostic({
        checkId: "operation.setRuntimeVisibility.invalidTargetKind",
        message: `setRuntimeVisibility can only target drawable refs, received ${target.kind}:${target.id}.`,
        target
      })
    ];
  }

  const drawable = getDrawableById(session.graph, target.id as DrawableId);
  if (drawable === undefined) {
    return [
      createOperationDiagnostic({
        checkId: "operation.setRuntimeVisibility.missingDrawable",
        message: `Drawable does not exist: ${target.id}.`,
        target
      })
    ];
  }

  if (drawable.runtimeVisibility === request.payload.runtimeVisibility) {
    return [
      createOperationDiagnostic({
        checkId: "operation.setRuntimeVisibility.noOp",
        message: `Drawable ${target.id} already has runtimeVisibility=${request.payload.runtimeVisibility}.`,
        target,
        severity: "warning"
      })
    ];
  }

  return [];
};

const createSetRuntimeVisibilityMutationDiagnostic = (
  error: AuthoringMutationError,
  operationId: OperationId
): DiagnosticDto => {
  const checkIdByCode: Partial<Record<AuthoringMutationError["code"], string>> = {
    missing_drawable: "operation.setRuntimeVisibility.missingDrawable",
    no_op_runtime_visibility_update: "operation.setRuntimeVisibility.noOp"
  };

  return createOperationDiagnostic({
    checkId: checkIdByCode[error.code] ?? "operation.setRuntimeVisibility.authoringMutationFailed",
    message: error.message,
    target: { kind: "operation", id: operationId },
    severity: error.code === "no_op_runtime_visibility_update" ? "warning" : "error"
  });
};

const createSetRuntimeVisibilityResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly drawableTarget: TargetRefDto;
  readonly before: boolean;
  readonly after: boolean;
}): OperationResultDto => {
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: input.drawableTarget,
        fields: [
          {
            path: `/model/drawables/${input.drawableTarget.id}/runtimeVisibility`,
            before: input.before,
            after: input.after
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
    precondition: createPreconditionResult([], [input.drawableTarget]),
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

const createDrawableTarget = (drawableId: string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});
