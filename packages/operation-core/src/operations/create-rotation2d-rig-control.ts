import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  createRotation2dRigControl
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  JsonValue,
  ModelDiffDto,
  OperationId,
  RigControlId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createRigControlIdFromDisplayName } from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

type CreateRotation2dRigControlRequest = Extract<
  OperationRequestDto,
  { operationType: "createRotation2dRigControl" }
>;
type PackageRotation2dRigControl = Parameters<typeof createRotation2dRigControl>[1];
type CreateRotation2dRigControlMutation = ReturnType<typeof createRotation2dRigControl>;

export const createRotation2dRigControlOperationHandler: OperationHandler = {
  operationType: "createRotation2dRigControl",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyCreateRotation2dRigControl(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyCreateRotation2dRigControl(session, request, operationId, "committed");
  }
};

const applyCreateRotation2dRigControl = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "createRotation2dRigControl") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.createRotation2dRigControl.unsupportedPayload",
            message: `createRotation2dRigControl handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const rigControlId = createRigControlIdFromDisplayName(request.payload.displayName);
  const rigControl = createPackageRotation2dRigControl(request, rigControlId);
  const targetIds = createCreateRotation2dRigControlTargetIds(request, rigControlId);
  const baseRevision = session.authoringRevision;

  try {
    const mutation = createRotation2dRigControl(session, rigControl);
    const result = createCreateRotation2dRigControlResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      mutation
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
        diagnostics: [createCreateRotation2dRigControlMutationDiagnostic(error, rigControl)]
      }),
      targetIds,
      candidateSession: session
    };
  }
};

const createPackageRotation2dRigControl = (
  request: CreateRotation2dRigControlRequest,
  rigControlId: RigControlId
): PackageRotation2dRigControl => ({
  kind: "rotation2d",
  rigControlId,
  displayName: request.payload.displayName,
  partId: request.payload.partId,
  childDrawableIds: [...request.payload.childDrawableIds],
  childRigControlIds: [...request.payload.childRigControlIds],
  pivot: structuredClone(request.payload.pivot),
  restAngleDegrees: request.payload.restAngleDegrees,
  restTranslation: { x: 0, y: 0 },
  restScale: { x: 1, y: 1 },
  enabled: true
});

const createCreateRotation2dRigControlResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly mutation: CreateRotation2dRigControlMutation;
}): OperationResultDto => {
  const rigControl = input.mutation.rigControl;
  const rigControlTarget: TargetRefDto = {
    kind: "rigControl",
    id: rigControl.rigControlId
  };
  const partTarget: TargetRefDto = {
    kind: "part",
    id: rigControl.partId,
    path: `/model/rigControls/rigControls/${rigControl.rigControlId}/partId`
  };
  const childDrawableTargets = rigControl.childDrawableIds.map((childDrawableId): TargetRefDto => ({
    kind: "drawable",
    id: childDrawableId,
    path: `/model/rigControls/rigControls/${rigControl.rigControlId}/childDrawableIds`
  }));
  const childRigControlTargets = input.mutation.childRigControlChanges.map((change): TargetRefDto => ({
    kind: "rigControl",
    id: change.after.rigControlId,
    path: `/model/rigControls/rigControls/${change.after.rigControlId}/parentId`
  }));
  const checkedTargetRefs = [
    rigControlTarget,
    partTarget,
    ...childDrawableTargets,
    ...childRigControlTargets
  ];
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [rigControlTarget],
    removed: [],
    changed: createCreateRotation2dRigControlChanges({
      packageId: input.packageId,
      rigControl,
      mutation: input.mutation
    }),
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], checkedTargetRefs),
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

const createCreateRotation2dRigControlChanges = (input: {
  readonly packageId: string;
  readonly rigControl: PackageRotation2dRigControl;
  readonly mutation: CreateRotation2dRigControlMutation;
}): ModelDiffDto["changed"] => {
  const rigControlPath = `/model/rigControls/rigControls/${input.rigControl.rigControlId}`;
  const changes: ModelDiffDto["changed"] = [
    {
      target: {
        kind: "package",
        id: input.packageId,
        path: "/model/rigControls/rigControls"
      },
      fields: [
        {
          path: "/model/rigControls/rigControls",
          before: null,
          after: input.rigControl.rigControlId
        }
      ]
    },
    {
      target: {
        kind: "rigControl",
        id: input.rigControl.rigControlId
      },
      fields: [
        {
          path: rigControlPath,
          before: null,
          after: toJsonValue(input.rigControl)
        }
      ]
    }
  ];

  if (rootIdsChanged(input.mutation)) {
    changes.push({
      target: {
        kind: "package",
        id: input.packageId,
        path: "/model/graph/rigControlRootIds"
      },
      fields: [
        {
          path: "/model/graph/rigControlRootIds",
          before: [...input.mutation.rigControlRootIdsBefore],
          after: [...input.mutation.rigControlRootIdsAfter]
        }
      ]
    });
  }

  for (const childDrawableId of input.rigControl.childDrawableIds) {
    changes.push({
      target: {
        kind: "drawable",
        id: childDrawableId,
        path: `${rigControlPath}/childDrawableIds`
      },
      fields: [
        {
          path: `${rigControlPath}/childDrawableIds`,
          before: null,
          after: childDrawableId
        }
      ]
    });
  }

  for (const childRigControlChange of input.mutation.childRigControlChanges) {
    changes.push({
      target: {
        kind: "rigControl",
        id: childRigControlChange.after.rigControlId
      },
      fields: [
        {
          path: `/model/rigControls/rigControls/${childRigControlChange.after.rigControlId}/parentId`,
          before: childRigControlChange.before.parentId ?? null,
          after: childRigControlChange.after.parentId ?? null
        }
      ]
    });
  }

  return changes;
};

const rootIdsChanged = (mutation: CreateRotation2dRigControlMutation): boolean =>
  JSON.stringify(mutation.rigControlRootIdsBefore) !== JSON.stringify(mutation.rigControlRootIdsAfter);

const createCreateRotation2dRigControlMutationDiagnostic = (
  error: AuthoringMutationError,
  rigControl: PackageRotation2dRigControl
): DiagnosticDto => {
  switch (error.code) {
    case "duplicate_rig_control":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.duplicateRigControl",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    case "missing_part":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.missingPart",
        message: error.message,
        target: { kind: "part", id: rigControl.partId }
      });
    case "missing_drawable":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.missingChildDrawable",
        message: error.message,
        target: {
          kind: "rigControl",
          id: rigControl.rigControlId,
          path: "/payload/childDrawableIds"
        }
      });
    case "missing_rig_control":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.missingChildRigControl",
        message: error.message,
        target: {
          kind: "rigControl",
          id: rigControl.rigControlId,
          path: "/payload/childRigControlIds"
        }
      });
    case "duplicate_rig_control_child":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.duplicateChild",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    case "rig_control_self_child":
    case "rig_control_cycle":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.cycle",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    case "rig_control_child_already_parented":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.childAlreadyParented",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.authoringMutationFailed",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
  }
};

const createCreateRotation2dRigControlTargetIds = (
  request: CreateRotation2dRigControlRequest,
  rigControlId: RigControlId
): readonly string[] =>
  [
    rigControlId,
    request.payload.partId,
    ...request.payload.childDrawableIds,
    ...request.payload.childRigControlIds
  ].filter((targetId, index, targetIds) => targetIds.indexOf(targetId) === index);

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
