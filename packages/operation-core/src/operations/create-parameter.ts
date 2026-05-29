import {
  createDryRunAuthoringSession,
  createParameter,
  getParameterById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DiagnosticDto, ModelDiffDto, OperationId, ParameterId, TargetRefDto } from "@private-2d-rigging-lab/contracts";

import { OperationResultSchema } from "../operation-result.js";
import type { OperationResultDto } from "../operation-result.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import { createParameterIdFromDisplayName } from "../operation-ids.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

export const createParameterOperationHandler: OperationHandler = {
  operationType: "createParameter",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyCreateParameter(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyCreateParameter(session, request, operationId, "committed");
  }
};

const applyCreateParameter = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "createParameter") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.createParameter.unsupportedPayload",
            message: `createParameter handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const parameterId = request.payload.parameterId ?? createParameterIdFromDisplayName(request.payload.displayName);
  const target: TargetRefDto = { kind: "parameter", id: parameterId };
  const preconditionDiagnostics = evaluateCreateParameterPreconditions(session, parameterId);

  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds: [parameterId],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const parameter = {
    parameterId,
    displayName: request.payload.displayName,
    ...(request.payload.semanticRole === undefined ? {} : { semanticRole: request.payload.semanticRole }),
    ...(request.payload.projectPresetAlias === undefined
      ? {}
      : { projectPresetAlias: request.payload.projectPresetAlias }),
    valueSource: request.payload.valueSource,
    min: request.payload.min,
    max: request.payload.max,
    default: request.payload.default,
    recommendedUiStep: request.payload.recommendedUiStep
  } satisfies Parameters<typeof createParameter>[1];

  const mutation = createParameter(session, parameter);
  const result = createCreateParameterResult({
    operationId,
    status,
    baseRevision,
    candidateRevision: mutation.authoringRevision,
    target
  });

  return {
    result,
    targetIds: [parameterId],
    candidateSession: session
  };
};

const evaluateCreateParameterPreconditions = (
  session: AuthoringSession,
  parameterId: ParameterId
): DiagnosticDto[] => {
  if (getParameterById(session.graph, parameterId) !== undefined) {
    return [
      createOperationDiagnostic({
        checkId: "operation.createParameter.duplicateParameter",
        message: `Parameter already exists: ${parameterId}.`,
        target: { kind: "parameter", id: parameterId }
      })
    ];
  }

  return [];
};

const createCreateParameterResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly target: TargetRefDto;
}): OperationResultDto => {
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [input.target],
    removed: [],
    changed: [
      {
        target: input.target,
        fields: [
          {
            path: "/model/parameters/parameters",
            before: null,
            after: input.target.id
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
    precondition: createPreconditionResult([], [input.target]),
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
