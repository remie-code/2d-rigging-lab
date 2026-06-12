import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  deleteParameter,
  updateParameter
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  UpdateParameterInput,
  UpdateParameterMutationResult
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { OperationResultSchema } from "../operation-result.js";
import type { OperationResultDto } from "../operation-result.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { toModelDiffJsonValue } from "./model-diff-json-value.js";

type UpdateParameterRequest = Extract<OperationRequestDto, { operationType: "updateParameter" }>;
type ParameterSnapshot = UpdateParameterMutationResult["parameterBefore"];

export const updateParameterOperationHandler: OperationHandler = {
  operationType: "updateParameter",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyUpdateParameter(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyUpdateParameter(session, request, operationId, "committed");
  }
};

export const deleteParameterOperationHandler: OperationHandler = {
  operationType: "deleteParameter",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyDeleteParameter(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyDeleteParameter(session, request, operationId, "committed");
  }
};

const applyUpdateParameter = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "updateParameter") {
    return rejectedUnsupportedPayload(session, operationId, "updateParameter", request.operationType);
  }

  const target: TargetRefDto = { kind: "parameter", id: request.payload.parameterId };
  const baseRevision = session.authoringRevision;

  try {
    const mutation = updateParameter(session, createUpdateParameterInput(request.payload));
    return {
      result: createParameterChangedResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        target,
        before: mutation.parameterBefore,
        after: mutation.parameterAfter
      }),
      targetIds: [request.payload.parameterId],
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createParameterMutationDiagnostic("updateParameter", error, target)]
      }),
      targetIds: [request.payload.parameterId],
      candidateSession: session
    };
  }
};

const applyDeleteParameter = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "deleteParameter") {
    return rejectedUnsupportedPayload(session, operationId, "deleteParameter", request.operationType);
  }

  const target: TargetRefDto = { kind: "parameter", id: request.payload.parameterId };
  const baseRevision = session.authoringRevision;

  try {
    const mutation = deleteParameter(session, request.payload.parameterId);
    return {
      result: createParameterDeletedResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        target,
        before: mutation.parameterBefore
      }),
      targetIds: [request.payload.parameterId],
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createParameterMutationDiagnostic("deleteParameter", error, target)]
      }),
      targetIds: [request.payload.parameterId],
      candidateSession: session
    };
  }
};

const rejectedUnsupportedPayload = (
  session: AuthoringSession,
  operationId: OperationId,
  handlerName: "updateParameter" | "deleteParameter",
  actualOperationType: string
): OperationApplyOutcome => ({
  result: createRejectedOperationResult({
    operationId,
    diagnostics: [
      createOperationDiagnostic({
        checkId: `operation.${handlerName}.unsupportedPayload`,
        message: `${handlerName} handler cannot apply ${actualOperationType}.`,
        target: { kind: "operation", id: operationId }
      })
    ]
  }),
  targetIds: [],
  candidateSession: session
});

const createParameterMutationDiagnostic = (
  operationName: "updateParameter" | "deleteParameter",
  error: AuthoringMutationError,
  target: TargetRefDto
): DiagnosticDto => {
  switch (error.code) {
    case "missing_parameter":
      return createOperationDiagnostic({
        checkId: `operation.${operationName}.missingParameter`,
        message: error.message,
        target
      });
    case "preset_parameter_locked":
      return createOperationDiagnostic({
        checkId: `operation.${operationName}.presetLocked`,
        message: error.message,
        target,
        evidence: ["lockedParameterKind=preset"]
      });
    case "invalid_parameter_range":
      return createOperationDiagnostic({
        checkId: `operation.${operationName}.invalidRange`,
        message: error.message,
        target
      });
    case "parameter_in_use":
      return createOperationDiagnostic({
        checkId: `operation.${operationName}.parameterInUse`,
        message: error.message,
        target,
        evidence: extractReferenceEvidence(error.message)
      });
    case "no_op_parameter_update":
      return createOperationDiagnostic({
        checkId: `operation.${operationName}.noOp`,
        message: error.message,
        target,
        severity: "warning"
      });
    default:
      return createOperationDiagnostic({
        checkId: `operation.${operationName}.authoringMutationFailed`,
        message: error.message,
        target
      });
  }
};

const createParameterChangedResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly target: TargetRefDto;
  readonly before: ParameterSnapshot;
  readonly after: ParameterSnapshot;
}): OperationResultDto => {
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: input.target,
        fields: createParameterFieldDiffs(input.before, input.after)
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

const createParameterDeletedResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly target: TargetRefDto;
  readonly before: ParameterSnapshot;
}): OperationResultDto => {
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [input.target],
    changed: [
      {
        target: input.target,
        fields: [
          {
            path: `/model/parameters/parameters/${input.before.parameterId}`,
            before: toModelDiffJsonValue(input.before),
            after: null
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

const createParameterFieldDiffs = (
  before: ParameterSnapshot,
  after: ParameterSnapshot
): ModelDiffDto["changed"][number]["fields"] =>
  (["displayName", "min", "max", "default", "recommendedUiStep"] as const)
    .filter((field) => before[field] !== after[field])
    .map((field) => ({
      path: `/model/parameters/parameters/${before.parameterId}/${field}`,
      before: before[field],
      after: after[field]
    }));

const createUpdateParameterInput = (
  payload: UpdateParameterRequest["payload"]
): UpdateParameterInput => ({
  parameterId: payload.parameterId,
  ...(payload.displayName === undefined ? {} : { displayName: payload.displayName }),
  ...(payload.min === undefined ? {} : { min: payload.min }),
  ...(payload.max === undefined ? {} : { max: payload.max }),
  ...(payload.default === undefined ? {} : { default: payload.default }),
  ...(payload.recommendedUiStep === undefined
    ? {}
    : { recommendedUiStep: payload.recommendedUiStep })
});

const extractReferenceEvidence = (message: string): readonly string[] => {
  const [, refs] = message.split("referenced:");
  if (refs === undefined) {
    return [];
  }

  return refs.split(",").map((ref) => `ref=${ref.trim()}`).filter((ref) => ref !== "ref=");
};
