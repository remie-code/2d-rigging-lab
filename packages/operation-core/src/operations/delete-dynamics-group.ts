import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  deleteDynamicsGroup
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

type DeleteDynamicsGroupRequest = Extract<OperationRequestDto, { operationType: "deleteDynamicsGroup" }>;
type PackageDynamicsGroup = ReturnType<typeof deleteDynamicsGroup>["dynamicsGroup"];

export const deleteDynamicsGroupOperationHandler: OperationHandler = {
  operationType: "deleteDynamicsGroup",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyDeleteDynamicsGroup(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyDeleteDynamicsGroup(session, request, operationId, "committed");
  }
};

const applyDeleteDynamicsGroup = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "deleteDynamicsGroup") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.deleteDynamicsGroup.unsupportedPayload",
            message: `deleteDynamicsGroup handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  try {
    const mutation = deleteDynamicsGroup(session, request.payload.dynamicsGroupId);
    const result = createDeleteDynamicsGroupResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      dynamicsGroup: mutation.dynamicsGroup
    });

    return {
      result,
      targetIds: createDeleteDynamicsGroupTargetIds(request),
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createDeleteDynamicsGroupMutationDiagnostic(error, request)]
      }),
      targetIds: createDeleteDynamicsGroupTargetIds(request),
      candidateSession: session
    };
  }
};

const createDeleteDynamicsGroupResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
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
    removed: [target],
    changed: [
      {
        target,
        fields: [
          {
            path: groupPath,
            before: toJsonValue(input.dynamicsGroup),
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

const createDeleteDynamicsGroupMutationDiagnostic = (
  error: AuthoringMutationError,
  request: DeleteDynamicsGroupRequest
): DiagnosticDto => {
  switch (error.code) {
    case "missing_dynamics_group":
      return createOperationDiagnostic({
        checkId: "operation.deleteDynamicsGroup.missingDynamicsGroup",
        message: error.message,
        target: {
          kind: "dynamicsGroup",
          id: request.payload.dynamicsGroupId
        }
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.deleteDynamicsGroup.authoringMutationFailed",
        message: error.message,
        target: {
          kind: "dynamicsGroup",
          id: request.payload.dynamicsGroupId
        }
      });
  }
};

const createDeleteDynamicsGroupTargetIds = (
  request: DeleteDynamicsGroupRequest
): readonly string[] => [request.payload.dynamicsGroupId];

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
