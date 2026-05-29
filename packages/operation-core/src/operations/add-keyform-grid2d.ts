import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  createParameterGrid2dKeyformSet,
  getParameterById
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AuthoringMutationErrorCode,
  AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  KeyformSetId,
  ModelDiffDto,
  OperationId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createKeyformSetIdFromOperationRequest } from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

type ParameterGrid2dKeyformSet = Parameters<typeof createParameterGrid2dKeyformSet>[1];
type KeyformTarget = ParameterGrid2dKeyformSet["target"];

export const addKeyformGrid2dOperationHandler: OperationHandler = {
  operationType: "addKeyformGrid2d",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyAddKeyformGrid2d(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyAddKeyformGrid2d(session, request, operationId, "committed");
  }
};

const applyAddKeyformGrid2d = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "addKeyformGrid2d") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.addKeyformGrid2d.unsupportedPayload",
            message: `addKeyformGrid2d handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const keyformSetId = createKeyformSetIdFromOperationRequest(request);
  const targetIds = createTargetIds(request, keyformSetId);
  const targetConversion = createKeyformTarget(request);

  if (!targetConversion.ok) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [targetConversion.diagnostic]
      }),
      targetIds,
      candidateSession: session
    };
  }

  const keyformSet: ParameterGrid2dKeyformSet = {
    keyformSetId,
    target: targetConversion.target,
    parameterX: request.payload.parameterX,
    parameterY: request.payload.parameterY,
    evaluator: request.payload.evaluator,
    interpolation: request.payload.interpolation,
    clampPolicy: request.payload.clampPolicy,
    missingKeyPolicy: "diagnostic-error",
    compositionMode: "additiveDelta",
    compositionOrder: 0,
    keys: request.payload.keys.map((key) => ({
      x: key.x,
      y: key.y,
      statePatch: structuredClone(key.statePatch)
    }))
  };

  const baseRevision = session.authoringRevision;

  try {
    const mutation = createParameterGrid2dKeyformSet(session, keyformSet);

    return {
      result: createAddKeyformGrid2dResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        packageId: session.packageIdentity.packageId,
        keyformSet: mutation.keyformSet
      }),
      targetIds,
      candidateSession: session
    };
  } catch (error) {
    if (error instanceof AuthoringMutationError) {
      return {
        result: createRejectedOperationResult({
          operationId,
          diagnostics: [
            createAuthoringMutationDiagnostic({
              error,
              session,
              request,
              keyformSetId
            })
          ]
        }),
        targetIds,
        candidateSession: session
      };
    }

    throw error;
  }
};

const createKeyformTarget = (
  request: Extract<OperationRequestDto, { operationType: "addKeyformGrid2d" }>
): { readonly ok: true; readonly target: KeyformTarget } | {
  readonly ok: false;
  readonly diagnostic: DiagnosticDto;
} => {
  switch (request.payload.target.kind) {
    case "mesh":
    case "rigControl":
    case "drawable":
      return {
        ok: true,
        target: {
          kind: request.payload.target.kind,
          id: request.payload.target.id,
          property: request.payload.targetProperty
        }
      };
    default:
      return {
        ok: false,
        diagnostic: createOperationDiagnostic({
          checkId: "operation.addKeyformGrid2d.unsupportedTargetKind",
          message: `addKeyformGrid2d cannot target ${request.payload.target.kind}:${request.payload.target.id}.`,
          target: request.payload.target
        })
      };
  }
};

const createAddKeyformGrid2dResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly keyformSet: ParameterGrid2dKeyformSet;
}): OperationResultDto => {
  const keyformSetTarget: TargetRefDto = {
    kind: "keyformSet",
    id: input.keyformSet.keyformSetId
  };
  const parameterXTarget: TargetRefDto = {
    kind: "parameter",
    id: input.keyformSet.parameterX
  };
  const parameterYTarget: TargetRefDto = {
    kind: "parameter",
    id: input.keyformSet.parameterY
  };
  const operationTarget = createOperationTargetRef(input.keyformSet.target);
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [keyformSetTarget],
    removed: [],
    changed: [
      {
        target: { kind: "package", id: input.packageId },
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
            path: `/model/keyforms/keyformSets/${input.keyformSet.keyformSetId}`,
            before: null,
            after: input.keyformSet
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
      parameterXTarget,
      parameterYTarget,
      operationTarget
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

const createAuthoringMutationDiagnostic = (input: {
  readonly error: AuthoringMutationError;
  readonly session: AuthoringSession;
  readonly request: Extract<OperationRequestDto, { operationType: "addKeyformGrid2d" }>;
  readonly keyformSetId: KeyformSetId;
}): DiagnosticDto =>
  createOperationDiagnostic({
    checkId: authoringMutationCheckIds[input.error.code],
    message: input.error.message,
    target: createAuthoringMutationDiagnosticTarget(input)
  });

const createAuthoringMutationDiagnosticTarget = (input: {
  readonly error: AuthoringMutationError;
  readonly session: AuthoringSession;
  readonly request: Extract<OperationRequestDto, { operationType: "addKeyformGrid2d" }>;
  readonly keyformSetId: KeyformSetId;
}): TargetRefDto => {
  switch (input.error.code) {
    case "duplicate_keyform_set":
    case "duplicate_keyform_grid_coordinate":
      return { kind: "keyformSet", id: input.keyformSetId };
    case "missing_parameter":
      return { kind: "parameter", id: findMissingAxisParameterId(input.session, input.request) };
    case "duplicate_keyform_grid_axis_parameter":
      return { kind: "parameter", id: input.request.payload.parameterX };
    case "missing_keyform_target":
    case "unsupported_keyform_target_property":
      return input.request.payload.target;
    case "duplicate_parameter":
      return { kind: "parameter", id: input.request.payload.parameterX };
  }
};

const findMissingAxisParameterId = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "addKeyformGrid2d" }>
): string => {
  if (getParameterById(session.graph, request.payload.parameterX) === undefined) {
    return request.payload.parameterX;
  }

  return request.payload.parameterY;
};

const createTargetIds = (
  request: Extract<OperationRequestDto, { operationType: "addKeyformGrid2d" }>,
  keyformSetId: KeyformSetId
): readonly string[] =>
  uniqueStrings([
    keyformSetId,
    request.payload.target.id,
    request.payload.parameterX,
    request.payload.parameterY
  ]);

const uniqueStrings = (values: readonly string[]): readonly string[] => {
  const unique = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!unique.has(value)) {
      unique.add(value);
      result.push(value);
    }
  }

  return result;
};

const authoringMutationCheckIds = {
  duplicate_parameter: "operation.addKeyformGrid2d.duplicateParameter",
  duplicate_keyform_set: "operation.addKeyformGrid2d.duplicateKeyformSet",
  missing_parameter: "operation.addKeyformGrid2d.missingParameter",
  missing_keyform_target: "operation.addKeyformGrid2d.missingTarget",
  unsupported_keyform_target_property: "operation.addKeyformGrid2d.unsupportedTargetProperty",
  duplicate_keyform_grid_axis_parameter: "operation.addKeyformGrid2d.duplicateAxisParameter",
  duplicate_keyform_grid_coordinate: "operation.addKeyformGrid2d.duplicateGridCoordinate"
} satisfies Record<AuthoringMutationErrorCode, string>;

const createOperationTargetRef = (target: KeyformTarget): TargetRefDto => {
  switch (target.kind) {
    case "mesh":
    case "rigControl":
    case "drawable":
      return {
        kind: target.kind,
        id: target.id
      };
    case "opacity":
    case "visibility":
    case "drawOrder":
      return {
        kind: "drawable",
        id: target.id,
        path: `/model/keyforms/keyformTargets/${target.kind}/${target.property}`
      };
  }
};
