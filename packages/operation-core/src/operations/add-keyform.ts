import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  createLinear1dKeyformSet
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
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

type Linear1dKeyformSetInput = Parameters<typeof createLinear1dKeyformSet>[1];
type PackageKeyformTarget = Linear1dKeyformSetInput["target"];

export const addKeyformOperationHandler: OperationHandler = {
  operationType: "addKeyform",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyAddKeyform(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyAddKeyform(session, request, operationId, "committed");
  }
};

const applyAddKeyform = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "addKeyform") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.addKeyform.unsupportedPayload",
            message: `addKeyform handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const keyformSetId = createKeyformSetIdFromOperationRequest(request);
  const targetConversion = toPackageKeyformTarget(
    request.payload.target,
    request.payload.targetProperty
  );
  const statePatchPropertyDiagnostic = validateStatePatchTargetProperty(request);
  const targetIds = createAddKeyformTargetIds({
    keyformSetId,
    parameterId: request.payload.parameterId,
    target: request.payload.target
  });

  if (statePatchPropertyDiagnostic !== undefined) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [statePatchPropertyDiagnostic]
      }),
      targetIds,
      candidateSession: session
    };
  }

  if ("diagnostic" in targetConversion) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [targetConversion.diagnostic]
      }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const keyformSet: Linear1dKeyformSetInput = {
    keyformSetId,
    target: targetConversion.target,
    parameterId: request.payload.parameterId,
    evaluator: "linear-1d-v1",
    interpolation: request.payload.interpolation,
    compositionMode: "replace",
    compositionOrder: 0,
    keys: [
      {
        value: request.payload.keyValue,
        statePatch: request.payload.statePatch.value
      }
    ]
  };

  try {
    const mutation = createLinear1dKeyformSet(session, keyformSet);
    const result = createAddKeyformResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      keyformSet: mutation.keyformSet,
      operationTarget: request.payload.target
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

    const diagnostics = [
      createAddKeyformMutationDiagnostic(error, {
        operationId,
        keyformSetId,
        parameterId: request.payload.parameterId,
        operationTarget: request.payload.target,
        packageTarget: targetConversion.target
      })
    ];

    return {
      result: createRejectedOperationResult({ operationId, diagnostics }),
      targetIds,
      candidateSession: session
    };
  }
};

const validateStatePatchTargetProperty = (
  request: Extract<OperationRequestDto, { operationType: "addKeyform" }>
): DiagnosticDto | undefined => {
  if (request.payload.statePatch.propertyPath === request.payload.targetProperty) {
    return undefined;
  }

  return createOperationDiagnostic({
    checkId: "operation.addKeyform.statePatchPropertyMismatch",
    message: `addKeyform targetProperty ${request.payload.targetProperty} must match statePatch.propertyPath ${request.payload.statePatch.propertyPath}.`,
    target: {
      ...request.payload.target,
      path: "/payload/statePatch/propertyPath"
    }
  });
};

const toPackageKeyformTarget = (
  target: TargetRefDto,
  targetProperty: string
): { readonly target: PackageKeyformTarget } | { readonly diagnostic: DiagnosticDto } => {
  switch (target.kind) {
    case "drawable":
    case "mesh":
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
          checkId: "operation.addKeyform.unsupportedTargetKind",
          message: `addKeyform cannot target ${target.kind}:${target.id}.`,
          target
        })
      };
  }
};

const createAddKeyformMutationDiagnostic = (
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
        checkId: "operation.addKeyform.duplicateKeyformSet",
        message: error.message,
        target: { kind: "keyformSet", id: context.keyformSetId }
      });
    case "missing_parameter":
      return createOperationDiagnostic({
        checkId: "operation.addKeyform.missingParameter",
        message: error.message,
        target: { kind: "parameter", id: context.parameterId }
      });
    case "missing_keyform_target":
      return createOperationDiagnostic({
        checkId: "operation.addKeyform.missingTarget",
        message: error.message,
        target: context.operationTarget
      });
    case "unsupported_keyform_target_property":
      return createOperationDiagnostic({
        checkId: "operation.addKeyform.unsupportedTargetProperty",
        message: error.message,
        target: {
          ...context.operationTarget,
          path: `/model/keyforms/keyformTargets/${context.packageTarget.kind}/${context.packageTarget.property}`
        }
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.addKeyform.authoringMutationFailed",
        message: error.message,
        target: { kind: "operation", id: context.operationId }
      });
  }
};

const createAddKeyformResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly keyformSet: Linear1dKeyformSetInput;
  readonly operationTarget: TargetRefDto;
}): OperationResultDto => {
  const keyformSetTarget: TargetRefDto = {
    kind: "keyformSet",
    id: input.keyformSet.keyformSetId
  };
  const parameterTarget: TargetRefDto = {
    kind: "parameter",
    id: input.keyformSet.parameterId
  };
  const keyformSetPath = `/model/keyforms/keyformSets/${input.keyformSet.keyformSetId}`;
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [keyformSetTarget],
    removed: [],
    changed: [
      {
        target: {
          kind: "package",
          id: input.packageId,
          path: "/model/keyforms/keyformSets"
        },
        fields: [
          {
            path: "/model/keyforms/keyformSets",
            before: null,
            after: input.keyformSet.keyformSetId
          }
        ]
      },
      {
        target: keyformSetTarget,
        fields: [
          {
            path: keyformSetPath,
            before: null,
            after: input.keyformSet
          }
        ]
      },
      {
        target: parameterTarget,
        fields: [
          {
            path: `${keyformSetPath}/parameterId`,
            before: null,
            after: input.keyformSet.parameterId
          }
        ]
      },
      {
        target: input.operationTarget,
        fields: [
          {
            path: `${keyformSetPath}/target`,
            before: null,
            after: input.keyformSet.target
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

const createAddKeyformTargetIds = (input: {
  readonly keyformSetId: KeyformSetId;
  readonly parameterId: ParameterId;
  readonly target: TargetRefDto;
}): readonly string[] =>
  [...new Set([input.keyformSetId, input.parameterId, input.target.id])];
