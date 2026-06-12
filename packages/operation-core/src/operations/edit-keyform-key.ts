import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  editLinear1dKeyformSet,
  getInitializedParameterById
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AuthoringSession,
  EditLinearKeyformInput,
  EditLinearKeyformMutationResult,
  LinearKeyformKeyInput
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  KeyformSetId,
  ModelDiffDto,
  OperationId,
  ParameterId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { OperationResultSchema } from "../operation-result.js";
import type { OperationResultDto } from "../operation-result.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import { createKeyformSetIdFromOperationRequest } from "../operation-ids.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

type EditKeyformRequest = Extract<OperationRequestDto, { operationType: "editKeyformKey" }>;
type PackageKeyformTarget = EditLinearKeyformInput["target"];

export const editKeyformKeyOperationHandler: OperationHandler = {
  operationType: "editKeyformKey",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyEditKeyformKey(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyEditKeyformKey(session, request, operationId, "committed");
  }
};

const applyEditKeyformKey = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "editKeyformKey") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.editKeyformKey.unsupportedPayload",
            message: `editKeyformKey handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const keyformSetId = createKeyformSetIdFromOperationRequest(request);
  const targetIds = createEditKeyformTargetIds({
    keyformSetId,
    parameterId: request.payload.parameterId,
    target: request.payload.target
  });
  const targetConversion = toPackageKeyformTarget(request.payload.target, request.payload.targetProperty);
  const propertyDiagnostics = validateStatePatchTargetProperties(request);
  if (propertyDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: propertyDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }
  if ("diagnostic" in targetConversion) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: [targetConversion.diagnostic] }),
      targetIds,
      candidateSession: session
    };
  }

  const parameter = getInitializedParameterById(session.graph, request.payload.parameterId);
  if (parameter === undefined) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.editKeyformKey.missingParameter",
            message: `Parameter does not exist: ${request.payload.parameterId}.`,
            target: { kind: "parameter", id: request.payload.parameterId }
          })
        ]
      }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  try {
    const mutation = editLinear1dKeyformSet(session, {
      keyformSetId,
      action: request.payload.action,
      target: targetConversion.target,
      operationTarget: request.payload.target,
      parameterId: request.payload.parameterId,
      interpolation: request.payload.interpolation,
      ...(request.payload.compositionMode === undefined
        ? {}
        : { compositionMode: request.payload.compositionMode }),
      keys: createKeyInputs(request, {
        min: parameter.min,
        default: parameter.default,
        max: parameter.max
      })
    });

    return {
      result: createEditKeyformResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        packageId: session.packageIdentity.packageId,
        mutation,
        operationTarget: request.payload.target,
        parameterId: request.payload.parameterId
      }),
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
        diagnostics: [
          createEditKeyformMutationDiagnostic(error, {
            operationId,
            keyformSetId,
            parameterId: request.payload.parameterId,
            operationTarget: request.payload.target,
            packageTarget: targetConversion.target
          })
        ]
      }),
      targetIds,
      candidateSession: session
    };
  }
};

const createKeyInputs = (
  request: EditKeyformRequest,
  parameterRange: { readonly min: number; readonly default: number; readonly max: number }
): readonly LinearKeyformKeyInput[] => {
  if (request.payload.action === "deleteCurrent") {
    return [{ value: request.payload.keyValue, statePatch: 0 }];
  }
  if (request.payload.action === "addCurrent" || request.payload.action === "updateCurrent") {
    return [
      {
        value: request.payload.keyValue,
        statePatch: request.payload.statePatch.value
      }
    ];
  }
  if (request.payload.action === "createEnds") {
    return [
      {
        value: parameterRange.min,
        statePatch: request.payload.statePatches.min.value
      },
      {
        value: parameterRange.max,
        statePatch: request.payload.statePatches.max.value
      }
    ];
  }

  return [
    {
      value: parameterRange.min,
      statePatch: request.payload.statePatches.min.value
    },
    {
      value: parameterRange.default,
      statePatch: request.payload.statePatches.default.value
    },
    {
      value: parameterRange.max,
      statePatch: request.payload.statePatches.max.value
    }
  ];
};

const validateStatePatchTargetProperties = (request: EditKeyformRequest): readonly DiagnosticDto[] => {
  const patches = listStatePatches(request);
  return patches
    .filter((patch) => patch.propertyPath !== request.payload.targetProperty)
    .map((patch) =>
      createOperationDiagnostic({
        checkId: "operation.editKeyformKey.statePatchPropertyMismatch",
        message: `editKeyformKey targetProperty ${request.payload.targetProperty} must match statePatch.propertyPath ${patch.propertyPath}.`,
        target: {
          ...request.payload.target,
          path: patch.path
        }
      })
    );
};

const listStatePatches = (
  request: EditKeyformRequest
): readonly { readonly propertyPath: string; readonly path: string }[] => {
  if (request.payload.action === "deleteCurrent") {
    return [];
  }
  if (request.payload.action === "addCurrent" || request.payload.action === "updateCurrent") {
    return [
      {
        propertyPath: request.payload.statePatch.propertyPath,
        path: "/payload/statePatch/propertyPath"
      }
    ];
  }
  if (request.payload.action === "createEnds") {
    return [
      {
        propertyPath: request.payload.statePatches.min.propertyPath,
        path: "/payload/statePatches/min/propertyPath"
      },
      {
        propertyPath: request.payload.statePatches.max.propertyPath,
        path: "/payload/statePatches/max/propertyPath"
      }
    ];
  }

  return [
    {
      propertyPath: request.payload.statePatches.min.propertyPath,
      path: "/payload/statePatches/min/propertyPath"
    },
    {
      propertyPath: request.payload.statePatches.default.propertyPath,
      path: "/payload/statePatches/default/propertyPath"
    },
    {
      propertyPath: request.payload.statePatches.max.propertyPath,
      path: "/payload/statePatches/max/propertyPath"
    }
  ];
};

const toPackageKeyformTarget = (
  target: TargetRefDto,
  targetProperty: string
): { readonly target: PackageKeyformTarget } | { readonly diagnostic: DiagnosticDto } => {
  switch (target.kind) {
    case "drawable":
    case "rigControl":
      return {
        target: {
          kind: target.kind,
          id: target.id,
          property: targetProperty
        }
      };
    default:
      return {
        diagnostic: createOperationDiagnostic({
          checkId: "operation.editKeyformKey.unsupportedTargetKind",
          message: `editKeyformKey cannot target ${target.kind}:${target.id}.`,
          target
        })
      };
  }
};

const createEditKeyformMutationDiagnostic = (
  error: AuthoringMutationError,
  context: {
    readonly operationId: OperationId;
    readonly keyformSetId: KeyformSetId;
    readonly parameterId: ParameterId;
    readonly operationTarget: TargetRefDto;
    readonly packageTarget: PackageKeyformTarget;
  }
): DiagnosticDto => {
  switch (error.code) {
    case "duplicate_keyform_set":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.duplicateBinding",
        message: error.message,
        target: { kind: "keyformSet", id: context.keyformSetId }
      });
    case "missing_parameter":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.missingParameter",
        message: error.message,
        target: { kind: "parameter", id: context.parameterId }
      });
    case "missing_keyform_target":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.missingTarget",
        message: error.message,
        target: context.operationTarget
      });
    case "unsupported_keyform_target_property":
    case "incompatible_keyform_target_property":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.unsupportedTargetProperty",
        message: error.message,
        target: {
          ...context.operationTarget,
          path: `/model/keyforms/keyformTargets/${context.packageTarget.kind}/${context.packageTarget.property}`
        }
      });
    case "unsupported_keyform_composition_mode":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.unsupportedCompositionMode",
        message: error.message,
        target: {
          ...context.operationTarget,
          path: `/model/keyforms/keyformSets/${context.keyformSetId}/compositionMode`
        }
      });
    case "invalid_warp_lattice_control_point_offsets_patch":
    case "invalid_keyform_patch_shape":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.invalidPatchShape",
        message: error.message,
        target: {
          ...context.operationTarget,
          path: `/model/keyforms/keyformSets/${context.keyformSetId}/keys`
        }
      });
    case "duplicate_linear_keyform_key":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.duplicateKey",
        message: error.message,
        target: { kind: "keyformSet", id: context.keyformSetId }
      });
    case "missing_linear_keyform_key":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.missingKey",
        message: error.message,
        target: { kind: "keyformSet", id: context.keyformSetId }
      });
    case "missing_keyform_binding":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.missingBinding",
        message: error.message,
        target: { kind: "keyformSet", id: context.keyformSetId }
      });
    case "keyform_key_out_of_range":
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.keyOutOfRange",
        message: error.message,
        target: { kind: "parameter", id: context.parameterId }
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.editKeyformKey.authoringMutationFailed",
        message: error.message,
        target: { kind: "operation", id: context.operationId }
      });
  }
};

const createEditKeyformResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly mutation: EditLinearKeyformMutationResult;
  readonly operationTarget: TargetRefDto;
  readonly parameterId: ParameterId;
}): OperationResultDto => {
  const keyformSetTarget: TargetRefDto = {
    kind: "keyformSet",
    id: input.mutation.keyformSetId
  };
  const parameterTarget: TargetRefDto = {
    kind: "parameter",
    id: input.parameterId
  };
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: input.mutation.mutationKind === "created" ? [keyformSetTarget] : [],
    removed: input.mutation.mutationKind === "deleted" ? [keyformSetTarget] : [],
    changed: createChangedEntries({
      packageId: input.packageId,
      mutation: input.mutation,
      keyformSetTarget,
      parameterTarget,
      operationTarget: input.operationTarget
    }),
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], [
      keyformSetTarget,
      parameterTarget,
      input.operationTarget
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

const createChangedEntries = (input: {
  readonly packageId: string;
  readonly mutation: EditLinearKeyformMutationResult;
  readonly keyformSetTarget: TargetRefDto;
  readonly parameterTarget: TargetRefDto;
  readonly operationTarget: TargetRefDto;
}): ModelDiffDto["changed"] => {
  const keyformSetPath = `/model/keyforms/keyformSets/${input.mutation.keyformSetId}`;
  const keyformSetField = {
    path: keyformSetPath,
    before: input.mutation.keyformSetBefore ?? null,
    after: input.mutation.keyformSetAfter ?? null
  };

  return [
    ...(input.mutation.mutationKind === "created" || input.mutation.mutationKind === "deleted"
      ? [
          {
            target: {
              kind: "package",
              id: input.packageId,
              path: "/model/keyforms/keyformSets"
            },
            fields: [
              {
                path: "/model/keyforms/keyformSets",
                before: input.mutation.mutationKind === "created" ? null : input.mutation.keyformSetId,
                after: input.mutation.mutationKind === "created" ? input.mutation.keyformSetId : null
              }
            ]
          } satisfies ModelDiffDto["changed"][number]
        ]
      : []),
    {
      target: input.keyformSetTarget,
      fields: [keyformSetField]
    },
    {
      target: input.parameterTarget,
      fields: [
        {
          path: `${keyformSetPath}/parameterId`,
          before: input.mutation.keyformSetBefore?.parameterId ?? null,
          after: input.mutation.keyformSetAfter?.parameterId ?? null
        }
      ]
    },
    {
      target: input.operationTarget,
      fields: [
        {
          path: `${keyformSetPath}/target`,
          before: input.mutation.keyformSetBefore?.target ?? null,
          after: input.mutation.keyformSetAfter?.target ?? null
        }
      ]
    }
  ];
};

const createEditKeyformTargetIds = (input: {
  readonly keyformSetId: KeyformSetId;
  readonly parameterId: ParameterId;
  readonly target: TargetRefDto;
}): readonly string[] =>
  [...new Set([input.keyformSetId, input.parameterId, input.target.id])];
