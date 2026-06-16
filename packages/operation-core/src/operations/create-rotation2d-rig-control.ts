import {
  AuthoringMutationError,
  bindRigControlChild,
  createDryRunAuthoringSession,
  createRotation2dRigControl,
  insertRigControlBetweenParentAndChild,
  wrapRigControlChildren
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
type BindRigControlChildMutation = ReturnType<typeof bindRigControlChild>;
type InsertRigControlBetweenParentAndChildMutation = ReturnType<typeof insertRigControlBetweenParentAndChild>;
type WrapRigControlChildrenMutation = ReturnType<typeof wrapRigControlChildren>;

type CreateRotation2dRigControlApplyMutation =
  | {
      readonly mode: "create";
      readonly createMutation: CreateRotation2dRigControlMutation;
      readonly parentBindMutation?: BindRigControlChildMutation;
      readonly rigControlRootIdsBefore: readonly RigControlId[];
      readonly rigControlRootIdsAfter: readonly RigControlId[];
      readonly authoringRevision: number;
    }
  | {
      readonly mode: "insert";
      readonly insertMutation: InsertRigControlBetweenParentAndChildMutation;
      readonly rigControlRootIdsBefore: readonly RigControlId[];
      readonly rigControlRootIdsAfter: readonly RigControlId[];
      readonly authoringRevision: number;
    }
  | {
      readonly mode: "wrap";
      readonly wrapMutation: WrapRigControlChildrenMutation;
      readonly rigControlRootIdsBefore: readonly RigControlId[];
      readonly rigControlRootIdsAfter: readonly RigControlId[];
      readonly authoringRevision: number;
    };

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
  if (
    request.payload.insertBeforeChild !== undefined &&
    request.payload.parentRigControlId === undefined &&
    request.payload.wrapChildren === undefined
  ) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.createRotation2dRigControl.missingInsertionParent",
            message: "Insertion create requires parentRigControlId.",
            target: { kind: "rigControl", id: rigControlId, path: "/payload/parentRigControlId" }
          })
        ]
      }),
      targetIds,
      candidateSession: session
    };
  }

  const preflight =
    status === "committed"
      ? tryCreateRotation2dRigControlMutations(createDryRunAuthoringSession(session), rigControl, request)
      : undefined;
  if (preflight !== undefined && "diagnostic" in preflight) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [preflight.diagnostic]
      }),
      targetIds,
      candidateSession: session
    };
  }

  const applied = tryCreateRotation2dRigControlMutations(session, rigControl, request);
  if ("diagnostic" in applied) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [applied.diagnostic]
      }),
      targetIds,
      candidateSession: session
    };
  }

  const result = createCreateRotation2dRigControlResult({
    operationId,
    status,
    baseRevision,
    candidateRevision: applied.mutation.authoringRevision,
    packageId: session.packageIdentity.packageId,
    mutation: applied.mutation
  });

  return {
    result,
    targetIds: createCreateRotation2dRigControlTargetIds(request, rigControlId, applied.mutation),
    candidateSession: session
  };
};

const tryCreateRotation2dRigControlMutations = (
  session: AuthoringSession,
  rigControl: PackageRotation2dRigControl,
  request: CreateRotation2dRigControlRequest
):
  | { readonly mutation: CreateRotation2dRigControlApplyMutation }
  | { readonly diagnostic: DiagnosticDto } => {
  try {
    if (request.payload.wrapChildren !== undefined && request.payload.insertBeforeChild !== undefined) {
      throw new AuthoringMutationError(
        "rig_control_parent_child_mismatch",
        "Create rotation payload must not set both insertBeforeChild and wrapChildren"
      );
    }

    if (request.payload.wrapChildren !== undefined) {
      assertWrapChildrenPayloadCompatibility(request);
      const wrapMutation = wrapRigControlChildren(session, rigControl, {
        wrapChildren: request.payload.wrapChildren,
        ...(request.payload.parentRigControlId === undefined
          ? {}
          : { parentRigControlId: request.payload.parentRigControlId })
      });
      return {
        mutation: {
          mode: "wrap",
          wrapMutation,
          rigControlRootIdsBefore: wrapMutation.rigControlRootIdsBefore,
          rigControlRootIdsAfter: wrapMutation.rigControlRootIdsAfter,
          authoringRevision: wrapMutation.authoringRevision
        }
      };
    }

    if (request.payload.insertBeforeChild !== undefined) {
      const insertMutation = insertRigControlBetweenParentAndChild(session, rigControl, {
        parentRigControlId: request.payload.parentRigControlId as RigControlId,
        child: request.payload.insertBeforeChild
      });
      return {
        mutation: {
          mode: "insert",
          insertMutation,
          rigControlRootIdsBefore: insertMutation.rigControlRootIdsBefore,
          rigControlRootIdsAfter: insertMutation.rigControlRootIdsAfter,
          authoringRevision: insertMutation.authoringRevision
        }
      };
    }

    const createMutation = createRotation2dRigControl(session, rigControl);
    const parentBindMutation =
      request.payload.parentRigControlId === undefined
        ? undefined
        : bindRigControlChild(session, {
            parentRigControlId: request.payload.parentRigControlId,
            child: {
              kind: "rigControl",
              id: createMutation.rigControl.rigControlId
            }
          });

    return {
      mutation: {
        mode: "create",
        createMutation,
        ...(parentBindMutation === undefined ? {} : { parentBindMutation }),
        rigControlRootIdsBefore: createMutation.rigControlRootIdsBefore,
        rigControlRootIdsAfter:
          parentBindMutation?.rigControlRootIdsAfter ?? createMutation.rigControlRootIdsAfter,
        authoringRevision: parentBindMutation?.authoringRevision ?? createMutation.authoringRevision
      }
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      diagnostic: createCreateRotation2dRigControlMutationDiagnostic(error, rigControl)
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
  childDrawableIds: createRotationChildDrawableIds(request),
  childRigControlIds: createRotationChildRigControlIds(request),
  opacityMultiplier: request.payload.opacityMultiplier,
  pivot: structuredClone(request.payload.pivot),
  restAngleDegrees: request.payload.restAngleDegrees,
  restTranslation: { x: 0, y: 0 },
  restScale: { x: 1, y: 1 },
  enabled: true
});

const createRotationChildDrawableIds = (
  request: CreateRotation2dRigControlRequest
): PackageRotation2dRigControl["childDrawableIds"] =>
  request.payload.wrapChildren !== undefined
    ? request.payload.wrapChildren
        .filter((child) => child.kind === "drawable")
        .map((child) => child.id)
    : request.payload.insertBeforeChild?.kind === "drawable"
    ? [request.payload.insertBeforeChild.id]
    : [...request.payload.childDrawableIds];

const createRotationChildRigControlIds = (
  request: CreateRotation2dRigControlRequest
): PackageRotation2dRigControl["childRigControlIds"] =>
  request.payload.wrapChildren !== undefined
    ? request.payload.wrapChildren
        .filter((child) => child.kind === "rigControl")
        .map((child) => child.id)
    : request.payload.insertBeforeChild?.kind === "rigControl"
    ? [request.payload.insertBeforeChild.id]
    : [...request.payload.childRigControlIds];

const createCreateRotation2dRigControlResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly mutation: CreateRotation2dRigControlApplyMutation;
}): OperationResultDto => {
  const rigControl = getCreatedRigControl(input.mutation);
  const rigControlTarget: TargetRefDto = {
    kind: "rigControl",
    id: rigControl.rigControlId
  };
  const childDrawableTargets = rigControl.childDrawableIds.map((childDrawableId): TargetRefDto => ({
    kind: "drawable",
    id: childDrawableId,
    path: `/model/rigControls/rigControls/${rigControl.rigControlId}/childDrawableIds`
  }));
  const childRigControlTargets = getCreatedChildRigControlChanges(input.mutation).map((change): TargetRefDto => ({
    kind: "rigControl",
    id: change.after.rigControlId,
    path: `/model/rigControls/rigControls/${change.after.rigControlId}/parentId`
  }));
  const parentTarget = getParentTarget(input.mutation);
  const checkedTargetRefs = [
    rigControlTarget,
    ...(parentTarget === undefined ? [] : [parentTarget]),
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
  readonly mutation: CreateRotation2dRigControlApplyMutation;
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

  for (const childRigControlChange of getCreatedChildRigControlChanges(input.mutation)) {
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

  const parentListChange = getParentListChange(input.mutation);
  if (parentListChange !== undefined) {
    changes.push(parentListChange);
  }

  return changes;
};

const getCreatedRigControl = (
  mutation: CreateRotation2dRigControlApplyMutation
): PackageRotation2dRigControl =>
  mutation.mode === "create"
    ? mutation.createMutation.rigControl
    : mutation.mode === "insert"
      ? mutation.insertMutation.rigControl as PackageRotation2dRigControl
      : mutation.wrapMutation.rigControl as PackageRotation2dRigControl;

const getCreatedChildRigControlChanges = (
  mutation: CreateRotation2dRigControlApplyMutation
) =>
  mutation.mode === "create"
    ? mutation.createMutation.childRigControlChanges
    : mutation.mode === "insert"
      ? mutation.insertMutation.childRigControlChange === undefined
        ? []
        : [mutation.insertMutation.childRigControlChange]
      : mutation.wrapMutation.childRigControlChanges;

const getParentTarget = (
  mutation: CreateRotation2dRigControlApplyMutation
): TargetRefDto | undefined => {
  const parentId = mutation.mode === "create"
    ? mutation.parentBindMutation?.parentRigControlAfter.rigControlId
    : mutation.mode === "insert"
      ? mutation.insertMutation.parentRigControlAfter.rigControlId
      : mutation.wrapMutation.parentRigControlAfter?.rigControlId;
  if (parentId === undefined) {
    return undefined;
  }

  return {
    kind: "rigControl",
    id: parentId,
    path: `/model/rigControls/rigControls/${parentId}/childRigControlIds`
  };
};

const getParentListChange = (
  mutation: CreateRotation2dRigControlApplyMutation
): ModelDiffDto["changed"][number] | undefined => {
  const parentBefore = mutation.mode === "create"
    ? mutation.parentBindMutation?.parentRigControlBefore
    : mutation.mode === "insert"
      ? mutation.insertMutation.parentRigControlBefore
      : mutation.wrapMutation.parentRigControlBefore;
  const parentAfter = mutation.mode === "create"
    ? mutation.parentBindMutation?.parentRigControlAfter
    : mutation.mode === "insert"
      ? mutation.insertMutation.parentRigControlAfter
      : mutation.wrapMutation.parentRigControlAfter;
  if (parentBefore === undefined || parentAfter === undefined) {
    return undefined;
  }

  return {
    target: {
      kind: "rigControl",
      id: parentAfter.rigControlId
    },
    fields: [
      {
        path: `/model/rigControls/rigControls/${parentAfter.rigControlId}/childDrawableIds`,
        before: [...parentBefore.childDrawableIds],
        after: [...parentAfter.childDrawableIds]
      },
      {
        path: `/model/rigControls/rigControls/${parentAfter.rigControlId}/childRigControlIds`,
        before: [...parentBefore.childRigControlIds],
        after: [...parentAfter.childRigControlIds]
      }
    ].filter((field) => JSON.stringify(field.before) !== JSON.stringify(field.after))
  };
};

const rootIdsChanged = (mutation: CreateRotation2dRigControlApplyMutation): boolean =>
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
    case "duplicate_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.duplicateBinding",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    case "missing_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.missingInsertionChildBinding",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    case "rig_control_parent_child_mismatch":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.parentChildMismatch",
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
    case "invalid_rig_control_opacity_multiplier":
      return createOperationDiagnostic({
        checkId: "operation.createRotation2dRigControl.invalidOpacityMultiplier",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId, path: "/payload/opacityMultiplier" }
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
  rigControlId: RigControlId,
  mutation?: CreateRotation2dRigControlApplyMutation
): readonly string[] =>
  [
    rigControlId,
    ...(request.payload.parentRigControlId === undefined ? [] : [request.payload.parentRigControlId]),
    ...getMutationParentTargetIds(mutation),
    ...(request.payload.insertBeforeChild === undefined ? [] : [request.payload.insertBeforeChild.id]),
    ...(request.payload.wrapChildren === undefined
      ? [...request.payload.childDrawableIds, ...request.payload.childRigControlIds]
      : request.payload.wrapChildren.map((child) => child.id))
  ].filter((targetId, index, targetIds) => targetIds.indexOf(targetId) === index);

const assertWrapChildrenPayloadCompatibility = (
  request: CreateRotation2dRigControlRequest
): void => {
  const wrapChildren = request.payload.wrapChildren;
  if (wrapChildren === undefined) {
    return;
  }

  const legacyChildListsWereProvided =
    request.payload.childDrawableIds.length > 0 ||
    request.payload.childRigControlIds.length > 0;
  if (!legacyChildListsWereProvided) {
    return;
  }

  const expectedDrawableIds = wrapChildren
    .filter((child) => child.kind === "drawable")
    .map((child) => child.id);
  const expectedRigControlIds = wrapChildren
    .filter((child) => child.kind === "rigControl")
    .map((child) => child.id);
  if (
    !sameOrderedIds(request.payload.childDrawableIds, expectedDrawableIds) ||
    !sameOrderedIds(request.payload.childRigControlIds, expectedRigControlIds)
  ) {
    throw new AuthoringMutationError(
      "rig_control_parent_child_mismatch",
      "When wrapChildren is set, childDrawableIds and childRigControlIds must be omitted or match wrapChildren"
    );
  }
};

const getMutationParentTargetIds = (
  mutation: CreateRotation2dRigControlApplyMutation | undefined
): readonly RigControlId[] => {
  if (mutation?.mode !== "wrap" || mutation.wrapMutation.parentRigControlAfter === undefined) {
    return [];
  }

  return [mutation.wrapMutation.parentRigControlAfter.rigControlId];
};

const sameOrderedIds = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
