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
  ParameterId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import {
  createDynamicsDriverId,
  createDynamicsGroupIdFromDisplayName,
  createDynamicsOutputId
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

  if (request.payload.drivers === undefined || request.payload.drivers.length === 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.missingDriverBinding",
        message: "createDynamicsGroup requires at least one authoredInput driver binding for package materialization.",
        target: { kind: "dynamicsGroup", id: dynamicsGroupId, path: "/payload/drivers" }
      })
    );
  }

  if (request.payload.output === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.missingOutputBinding",
        message: "createDynamicsGroup requires one computedDynamics output binding for package materialization.",
        target: { kind: "dynamicsGroup", id: dynamicsGroupId, path: "/payload/output" }
      })
    );
  }

  return diagnostics;
};

const createPackageDynamicsGroup = (
  request: CreateDynamicsGroupRequest,
  dynamicsGroupId: DynamicsGroupId
): PackageDynamicsGroup => {
  const drivers = request.payload.drivers ?? [];
  const output = request.payload.output;

  if (output === undefined) {
    throw new Error("createPackageDynamicsGroup requires output after precondition evaluation.");
  }

  return {
    dynamicsGroupId,
    displayName: request.payload.displayName,
    enabled: request.payload.enabled,
    solverKind: request.payload.solverKind,
    drivers: drivers.map((driver) => ({
      driverId: driver.driverId ?? createDynamicsDriverId(dynamicsGroupId, driver.sourceParameterId),
      sourceParameterId: driver.sourceParameterId,
      inputScale: driver.inputScale,
      inputOffset: driver.inputOffset,
      invert: driver.invert
    })),
    output: {
      outputId: output.outputId ?? createDynamicsOutputId(dynamicsGroupId, output.targetParameterId),
      targetParameterId: output.targetParameterId,
      outputScale: output.outputScale,
      outputOffset: output.outputOffset,
      min: output.min,
      max: output.max,
      clampPolicy: output.clampPolicy
    },
    settings: structuredClone(request.payload.settings),
    resetPolicy: request.payload.resetPolicy
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
  const driverParameterTargets = input.dynamicsGroup.drivers.map((driver) => ({
    kind: "parameter" as const,
    id: driver.sourceParameterId,
    path: `${dynamicsGroupPath}/drivers/${driver.driverId}/sourceParameterId`
  }));
  const outputParameterTarget: TargetRefDto = {
    kind: "parameter",
    id: input.dynamicsGroup.output.targetParameterId,
    path: `${dynamicsGroupPath}/output/targetParameterId`
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
      ...input.dynamicsGroup.drivers.map((driver, index) => ({
        target: driverParameterTargets[index] as TargetRefDto,
        fields: [
          {
            path: `${dynamicsGroupPath}/drivers/${driver.driverId}/sourceParameterId`,
            before: null,
            after: driver.sourceParameterId
          }
        ]
      })),
      {
        target: outputParameterTarget,
        fields: [
          {
            path: `${dynamicsGroupPath}/output/targetParameterId`,
            before: null,
            after: input.dynamicsGroup.output.targetParameterId
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
      ...driverParameterTargets,
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
        checkId: "operation.createDynamicsGroup.missingDriverParameter",
        message: error.message,
        target: {
          kind: "dynamicsGroup",
          id: dynamicsGroup.dynamicsGroupId,
          path: "/payload/drivers"
        }
      });
    case "missing_dynamics_output_parameter":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.missingOutputParameter",
        message: error.message,
        target: {
          kind: "parameter",
          id: dynamicsGroup.output.targetParameterId,
          path: "/payload/output/targetParameterId"
        }
      });
    case "invalid_dynamics_driver_parameter_source":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.invalidDriverParameterSource",
        message: error.message,
        target: {
          kind: "dynamicsGroup",
          id: dynamicsGroup.dynamicsGroupId,
          path: "/payload/drivers"
        }
      });
    case "invalid_dynamics_output_parameter_source":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.invalidOutputParameterSource",
        message: error.message,
        target: {
          kind: "parameter",
          id: dynamicsGroup.output.targetParameterId,
          path: "/payload/output/targetParameterId"
        }
      });
    case "duplicate_dynamics_driver":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.duplicateDriver",
        message: error.message,
        target: {
          kind: "dynamicsGroup",
          id: dynamicsGroup.dynamicsGroupId,
          path: "/payload/drivers"
        }
      });
    case "duplicate_dynamics_output_parameter":
      return createOperationDiagnostic({
        checkId: "operation.createDynamicsGroup.duplicateOutputParameter",
        message: error.message,
        target: {
          kind: "parameter",
          id: dynamicsGroup.output.targetParameterId,
          path: "/payload/output/targetParameterId"
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
    ...(request.payload.drivers?.map((driver) => driver.sourceParameterId) ?? []),
    ...(request.payload.output === undefined ? [] : [request.payload.output.targetParameterId])
  ];

  return [...new Set([dynamicsGroupId, ...parameterIds])];
};
