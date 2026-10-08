import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  createDynamicsGroup
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DynamicsGroupId,
  JsonValue,
  ModelDiffDto,
  OperationId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import {
  createDynamicsGroupIdFromDisplayName
} from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

type CreateDynamicsGroupRequest = Extract<OperationRequestDto, { operationType: "createDynamicsGroup" }>;
type PackageDynamicsGroup = Parameters<typeof createDynamicsGroup>[1];

export const createDynamicsGroupOperationHandler: OperationHandler = {
  operationType: "createDynamicsGroup",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyCreateDynamicsGroup(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyCreateDynamicsGroup(session, request, operationId, "committed");
  }
};

const applyCreateDynamicsGroup = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "createDynamicsGroup") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.createDynamicsGroup.unsupportedPayload",
            message: `createDynamicsGroup handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const dynamicsGroupId =
    request.payload.dynamicsGroupId ?? createDynamicsGroupIdFromDisplayName(request.payload.displayName);
  const missingBindingDiagnostics = evaluateInitialBindingPreconditions(request, dynamicsGroupId);
  const targetIds = createCreateDynamicsGroupTargetIds(request, dynamicsGroupId);

  if (missingBindingDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: missingBindingDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const dynamicsGroup = createPackageDynamicsGroup(request, dynamicsGroupId);
  const baseRevision = session.authoringRevision;

  try {
    const mutation = createDynamicsGroup(session, dynamicsGroup);
    const result = createCreateDynamicsGroupResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      dynamicsGroup: mutation.dynamicsGroup
    });

    return {
      result,
      targetIds,
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createCreateDynamicsGroupMutationDiagnostic(error, dynamicsGroup)]
      }),
      targetIds,
      candidateSession: session
    };
  }
};

const evaluateInitialBindingPreconditions = (
  request: CreateDynamicsGroupRequest,
  dynamicsGroupId: DynamicsGroupId
): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (request.payload.inputs === undefined || request.payload.inputs.length === 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.missingInputBinding",
        message: "createDynamicsGroup requires at least one Dynamics input binding for package materialization.",
        target: { kind: "dynamicsGroup", id: dynamicsGroupId, path: "/payload/inputs" }
      })
    );
  }

  if (request.payload.chain === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.missingChain",
        message: "createDynamicsGroup requires a Dynamics chain for package materialization.",
        target: { kind: "dynamicsGroup", id: dynamicsGroupId, path: "/payload/chain" }
      })
    );
  }

  if (request.payload.outputs === undefined || request.payload.outputs.length === 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.missingOutputBinding",
        message: "createDynamicsGroup requires at least one additive output binding for package materialization.",
        target: { kind: "dynamicsGroup", id: dynamicsGroupId, path: "/payload/outputs" }
      })
    );
  }

  return diagnostics;
};

const createPackageDynamicsGroup = (
  request: CreateDynamicsGroupRequest,
  dynamicsGroupId: DynamicsGroupId
): PackageDynamicsGroup => {
  const inputs = request.payload.inputs ?? [];
  const chain = request.payload.chain;
  const outputs = request.payload.outputs ?? [];

  if (chain === undefined || inputs.length === 0 || outputs.length === 0) {
    throw new Error("createPackageDynamicsGroup requires inputs, a chain, and outputs after precondition evaluation.");
  }

  return {
    dynamicsGroupId,
    displayName: request.payload.displayName,
    enabled: request.payload.enabled,
    ...(request.payload.presetId === undefined ? {} : { presetId: request.payload.presetId }),
    inputs: inputs.map((input) => ({
      parameterId: input.parameterId,
      kind: input.kind,
      scale: input.scale
    })),
    chain: {
      rootOffset: { x: chain.rootOffset.x, y: chain.rootOffset.y },
      segmentLengths: [...chain.segmentLengths],
      damping: chain.damping,
      gravityScale: chain.gravityScale
    },
    outputs: outputs.map((output) => ({
      parameterId: output.parameterId,
      segmentIndex: output.segmentIndex,
      scale: output.scale,
      limit: output.limit
    }))
  };
};

const createCreateDynamicsGroupResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly dynamicsGroup: PackageDynamicsGroup;
}): OperationResultDto => {
  const dynamicsGroupTarget: TargetRefDto = {
    kind: "dynamicsGroup",
    id: input.dynamicsGroup.dynamicsGroupId
  };
  const dynamicsGroupPath = `/model/dynamics/dynamicsGroups/${input.dynamicsGroup.dynamicsGroupId}`;
  const inputParameterTargets = input.dynamicsGroup.inputs.map((dynamicsInput, index) => ({
    kind: "parameter" as const,
    id: dynamicsInput.parameterId,
    path: `${dynamicsGroupPath}/inputs/${index}/parameterId`
  }));
  const outputParameterTarget: TargetRefDto = {
    kind: "parameter",
    id: input.dynamicsGroup.outputs[0]?.parameterId ?? input.dynamicsGroup.dynamicsGroupId,
    path: `${dynamicsGroupPath}/outputs/0/parameterId`
  };
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [dynamicsGroupTarget],
    removed: [],
    changed: [
      {
        target: {
          kind: "package",
          id: input.packageId,
          path: "/model/dynamics/dynamicsGroups"
        },
        fields: [
          {
            path: "/model/dynamics/dynamicsGroups",
            before: null,
            after: input.dynamicsGroup.dynamicsGroupId
          }
        ]
      },
      {
        target: dynamicsGroupTarget,
        fields: [
          {
            path: dynamicsGroupPath,
            before: null,
            after: toJsonValue(input.dynamicsGroup)
          }
        ]
      },
      ...input.dynamicsGroup.inputs.map((dynamicsInput, index) => ({
        target: inputParameterTargets[index] as TargetRefDto,
        fields: [
          {
            path: `${dynamicsGroupPath}/inputs/${index}/parameterId`,
            before: null,
            after: dynamicsInput.parameterId
          }
        ]
      })),
      {
        target: outputParameterTarget,
        fields: [
          {
            path: `${dynamicsGroupPath}/outputs/0/parameterId`,
            before: null,
            after: input.dynamicsGroup.outputs[0]?.parameterId ?? null
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
    precondition: createPreconditionResult([], [
      dynamicsGroupTarget,
      ...inputParameterTargets,
      outputParameterTarget
    ]),
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

const createCreateDynamicsGroupMutationDiagnostic = (
  error: AuthoringMutationError,
  dynamicsGroup: PackageDynamicsGroup
): DiagnosticDto => {
  switch (error.code) {
    case "duplicate_dynamics_group":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.duplicateDynamicsGroup",
        message: error.message,
        target: { kind: "dynamicsGroup", id: dynamicsGroup.dynamicsGroupId }
      });
    case "missing_dynamics_driver_parameter":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.missingInputParameter",
        message: error.message,
        target: {
          kind: "dynamicsGroup",
          id: dynamicsGroup.dynamicsGroupId,
          path: "/payload/inputs"
        }
      });
    case "missing_dynamics_output_parameter":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.missingOutputParameter",
        message: error.message,
        target: {
          kind: "parameter",
          id: dynamicsGroup.outputs[0]?.parameterId ?? dynamicsGroup.dynamicsGroupId,
          path: "/payload/outputs/0/parameterId"
        }
      });
    case "invalid_dynamics_group":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.invalidDynamicsGroup",
        message: error.message,
        target: {
          kind: "dynamicsGroup",
          id: dynamicsGroup.dynamicsGroupId,
          path: "/payload"
        }
      });
    case "duplicate_dynamics_output_parameter":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.duplicateOutputParameter",
        message: error.message,
        target: {
          kind: "parameter",
          id: dynamicsGroup.outputs[0]?.parameterId ?? dynamicsGroup.dynamicsGroupId,
          path: "/payload/outputs/0/parameterId"
        }
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.authoringMutationFailed",
        message: error.message,
        target: { kind: "dynamicsGroup", id: dynamicsGroup.dynamicsGroupId }
      });
  }
};

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;

const createCreateDynamicsGroupTargetIds = (
  request: CreateDynamicsGroupRequest,
  dynamicsGroupId: DynamicsGroupId
): readonly string[] => {
  const parameterIds = [
    ...(request.payload.inputs?.map((input) => input.parameterId) ?? []),
    ...(request.payload.outputs?.map((output) => output.parameterId) ?? [])
  ];

  return [...new Set([dynamicsGroupId, ...parameterIds])];
};
