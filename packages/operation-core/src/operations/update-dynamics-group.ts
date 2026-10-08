import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  updateDynamicsGroup
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  JsonValue,
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

type PackageDynamicsGroup = ReturnType<typeof updateDynamicsGroup>["dynamicsGroup"];

export const updateDynamicsGroupOperationHandler: OperationHandler = {
  operationType: "updateDynamicsGroup",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyUpdateDynamicsGroup(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyUpdateDynamicsGroup(session, request, operationId, "committed");
  }
};

const applyUpdateDynamicsGroup = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "updateDynamicsGroup") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.updateDynamicsGroup.unsupportedPayload",
            message: `updateDynamicsGroup handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const target: TargetRefDto = {
    kind: "dynamicsGroup",
    id: request.payload.dynamicsGroupId
  };
  const baseRevision = session.authoringRevision;

  try {
    const mutation = updateDynamicsGroup(session, {
      dynamicsGroupId: request.payload.dynamicsGroupId,
      ...(request.payload.displayName === undefined ? {} : { displayName: request.payload.displayName }),
      ...(request.payload.enabled === undefined ? {} : { enabled: request.payload.enabled }),
      ...(request.payload.presetId === undefined ? {} : { presetId: request.payload.presetId }),
      ...(request.payload.inputs === undefined ? {} : { inputs: request.payload.inputs }),
      ...(request.payload.chain === undefined ? {} : { chain: request.payload.chain }),
      ...(request.payload.outputs === undefined ? {} : { outputs: request.payload.outputs })
    });
    const result = createUpdateDynamicsGroupResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      previousDynamicsGroup: mutation.previousDynamicsGroup,
      dynamicsGroup: mutation.dynamicsGroup
    });

    return {
      result,
      targetIds: createUpdateDynamicsGroupTargetIds(request),
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createUpdateDynamicsGroupMutationDiagnostic(error, target)]
      }),
      targetIds: createUpdateDynamicsGroupTargetIds(request),
      candidateSession: session
    };
  }
};

const createUpdateDynamicsGroupResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly previousDynamicsGroup: PackageDynamicsGroup;
  readonly dynamicsGroup: PackageDynamicsGroup;
}): OperationResultDto => {
  const target: TargetRefDto = {
    kind: "dynamicsGroup",
    id: input.dynamicsGroup.dynamicsGroupId
  };
  const groupPath = `/model/dynamics/dynamicsGroups/${input.dynamicsGroup.dynamicsGroupId}`;
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target,
        fields: [
          {
            path: groupPath,
            before: toJsonValue(input.previousDynamicsGroup),
            after: toJsonValue(input.dynamicsGroup)
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
    precondition: createPreconditionResult([], [target]),
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

const createUpdateDynamicsGroupMutationDiagnostic = (
  error: AuthoringMutationError,
  target: TargetRefDto
): DiagnosticDto => {
  switch (error.code) {
    case "missing_dynamics_group":
      return createOperationDiagnostic({
        checkId: "operation.updateDynamicsGroup.missingDynamicsGroup",
        message: error.message,
        target
      });
    case "no_op_dynamics_group_update":
      return createOperationDiagnostic({
        checkId: "operation.updateDynamicsGroup.noOp",
        message: error.message,
        target,
        severity: "warning"
      });
    case "invalid_dynamics_group":
      return createOperationDiagnostic({
        checkId: "operation.updateDynamicsGroup.invalidDynamicsGroup",
        message: error.message,
        target
      });
    case "missing_dynamics_driver_parameter":
      return createOperationDiagnostic({
        checkId: "operation.updateDynamicsGroup.missingInputParameter",
        message: error.message,
        target
      });
    case "missing_dynamics_output_parameter":
      return createOperationDiagnostic({
        checkId: "operation.updateDynamicsGroup.missingOutputParameter",
        message: error.message,
        target
      });
    case "duplicate_dynamics_output_parameter":
      return createOperationDiagnostic({
        checkId: "operation.updateDynamicsGroup.duplicateOutputParameter",
        message: error.message,
        target
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.updateDynamicsGroup.authoringMutationFailed",
        message: error.message,
        target
      });
  }
};

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;

const createUpdateDynamicsGroupTargetIds = (
  request: Extract<OperationRequestDto, { operationType: "updateDynamicsGroup" }>
): readonly string[] => {
  const parameterIds = [
    ...(request.payload.inputs?.map((input) => input.parameterId) ?? []),
    ...(request.payload.outputs?.map((output) => output.parameterId) ?? [])
  ];

  return [...new Set([request.payload.dynamicsGroupId, ...parameterIds])];
};
