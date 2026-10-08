import {
  AuthoringMutationError,
  bindRigControlChild,
  createDryRunAuthoringSession,
  createWarpLattice2dRigControl,
  insertRigControlBetweenParentAndChild,
  wrapRigControlChildren
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { createWarpLattice2dControlPointSlots } from "@private-2d-rigging-lab/contracts";
import type {
  DiagnosticDto,
  JsonValue,
  ModelDiffDto,
  OperationId,
  RectDto,
  RigControlId,
  TargetRefDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";

import { createAvailableRigControlIdFromDisplayName } from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

const WARP_DEFORMER_CONTRACT_VERSION = "warp-deformer-foundation-v0";
const WARP_DEFORMER_BEZIER_EDIT_TYPE = "cubicBezierSurfaceV1";
const WARP_DEFORMER_BEZIER_POINT_ORDER = "rowMajorYThenXFromDomainMinV1";

type CreateWarpDeformerRequest = Extract<
  OperationRequestDto,
  { operationType: "createWarpDeformer" }
>;
type PackageWarpLattice2dRigControl = Parameters<typeof createWarpLattice2dRigControl>[1];
type PackageWarpDeformerMetadata = NonNullable<PackageWarpLattice2dRigControl["warpDeformer"]>;
type PackageWarpDeformerBezierEditSurface = PackageWarpDeformerMetadata["bezierEditSurface"];
type CreateWarpLattice2dRigControlMutation = ReturnType<typeof createWarpLattice2dRigControl>;
type BindRigControlChildMutation = ReturnType<typeof bindRigControlChild>;
type InsertRigControlBetweenParentAndChildMutation = ReturnType<typeof insertRigControlBetweenParentAndChild>;
type WrapRigControlChildrenMutation = ReturnType<typeof wrapRigControlChildren>;

type CreateWarpDeformerMutation =
  | {
      readonly mode: "create";
      readonly createMutation: CreateWarpLattice2dRigControlMutation;
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

export const createWarpDeformerOperationHandler: OperationHandler = {
  operationType: "createWarpDeformer",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyCreateWarpDeformer(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyCreateWarpDeformer(session, request, operationId, "committed");
  }
};

const applyCreateWarpDeformer = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "createWarpDeformer") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.createWarpDeformer.unsupportedPayload",
            message: `createWarpDeformer handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const rigControlId = createAvailableRigControlIdFromDisplayName(
    request.payload.displayName,
    session.graph.rigControls.map((rigControl) => rigControl.rigControlId)
  );
  const rigControl = createPackageWarpDeformerRigControl(request, rigControlId);
  const targetIds = createCreateWarpDeformerTargetIds(request, rigControlId);
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
            checkId: "operation.createWarpDeformer.missingInsertionParent",
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
      ? tryCreateWarpDeformerMutations(createDryRunAuthoringSession(session), rigControl, request)
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

  const applied = tryCreateWarpDeformerMutations(session, rigControl, request);
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

  return {
    result: createCreateWarpDeformerResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: applied.mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      mutation: applied.mutation
    }),
    targetIds: createCreateWarpDeformerTargetIds(request, rigControlId, applied.mutation),
    candidateSession: session
  };
};

const tryCreateWarpDeformerMutations = (
  session: AuthoringSession,
  rigControl: PackageWarpLattice2dRigControl,
  request: CreateWarpDeformerRequest
):
  | { readonly mutation: CreateWarpDeformerMutation }
  | { readonly diagnostic: DiagnosticDto } => {
  try {
    if (request.payload.wrapChildren !== undefined && request.payload.insertBeforeChild !== undefined) {
      throw new AuthoringMutationError(
        "rig_control_parent_child_mismatch",
        "Create Warp Deformer payload must not set both insertBeforeChild and wrapChildren"
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

    const createMutation = createWarpLattice2dRigControl(session, rigControl);
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
      diagnostic: createCreateWarpDeformerMutationDiagnostic(error, rigControl)
    };
  }
};

const createPackageWarpDeformerRigControl = (
  request: CreateWarpDeformerRequest,
  rigControlId: RigControlId
): PackageWarpLattice2dRigControl => ({
  kind: "warpLattice2d",
  rigControlId,
  displayName: request.payload.displayName,
  childDrawableIds: createWarpDeformerChildDrawableIds(request),
  childRigControlIds: createWarpDeformerChildRigControlIds(request),
  opacityMultiplier: request.payload.opacityMultiplier,
  bindSpace: "rigControlLocalRest",
  domainBounds: structuredClone(request.payload.domainBounds),
  latticeColumns: request.payload.transformColumns,
  latticeRows: request.payload.transformRows,
  restControlPoints: createRestControlPoints({
    domainBounds: request.payload.domainBounds,
    latticeColumns: request.payload.transformColumns,
    latticeRows: request.payload.transformRows
  }),
  interpolationMethod: "bilinear-grid-v1",
  warpDeformer: createWarpDeformerMetadata(request),
  enabled: true
});

const createWarpDeformerChildDrawableIds = (
  request: CreateWarpDeformerRequest
): PackageWarpLattice2dRigControl["childDrawableIds"] =>
  request.payload.wrapChildren !== undefined
    ? request.payload.wrapChildren
        .filter((child) => child.kind === "drawable")
        .map((child) => child.id)
    : request.payload.insertBeforeChild?.kind === "drawable"
    ? [request.payload.insertBeforeChild.id]
    : [...request.payload.childDrawableIds];

const createWarpDeformerChildRigControlIds = (
  request: CreateWarpDeformerRequest
): PackageWarpLattice2dRigControl["childRigControlIds"] =>
  request.payload.wrapChildren !== undefined
    ? request.payload.wrapChildren
        .filter((child) => child.kind === "rigControl")
        .map((child) => child.id)
    : request.payload.insertBeforeChild?.kind === "rigControl"
    ? [request.payload.insertBeforeChild.id]
    : [...request.payload.childRigControlIds];

const createWarpDeformerMetadata = (
  request: CreateWarpDeformerRequest
): PackageWarpDeformerMetadata => ({
  schemaVersion: WARP_DEFORMER_CONTRACT_VERSION,
  userFacingKind: "warpDeformer",
  transformGrid: {
    columns: request.payload.transformColumns,
    rows: request.payload.transformRows,
    pointCountSemantics: "controlPointCount"
  },
  bezierEditSurface: createBezierEditSurface({
    domainBounds: request.payload.domainBounds,
    columns: request.payload.bezierColumns,
    rows: request.payload.bezierRows,
    editType: request.payload.bezierEditType
  }),
  compatibility: {
    storageKind: "warpLattice2d",
    transformStorage: "latticeColumnsRows",
    restControlPointStorage: "restControlPoints",
    runtimeEvaluation: "bilinearGridV1",
    bezierEvaluation: "storedNotEvaluatedV0"
  }
});

const createBezierEditSurface = (input: {
  readonly domainBounds: RectDto;
  readonly columns: number;
  readonly rows: number;
  readonly editType: typeof WARP_DEFORMER_BEZIER_EDIT_TYPE;
}): PackageWarpDeformerBezierEditSurface => {
  const restControlPoints = createSurfaceGridPoints(input);
  const handles = restControlPoints.map(() => ({
    inTangent: { x: 0, y: 0 },
    outTangent: { x: 0, y: 0 }
  }));

  return {
    columns: input.columns,
    rows: input.rows,
    editType: input.editType,
    pointOrder: WARP_DEFORMER_BEZIER_POINT_ORDER,
    restControlPoints,
    handles,
    restSurfaceGeneration: {
      kind: "domainBoundsGridV1",
      sourceDomainBounds: structuredClone(input.domainBounds),
      columns: input.columns,
      rows: input.rows,
      pointOrder: WARP_DEFORMER_BEZIER_POINT_ORDER,
      handlePolicy: "zeroTangentsV1"
    }
  };
};

const createRestControlPoints = (input: {
  readonly domainBounds: RectDto;
  readonly latticeColumns: number;
  readonly latticeRows: number;
}): Vec2Dto[] =>
  createWarpLattice2dControlPointSlots(input).map((slot) => ({
    x: input.domainBounds.x + input.domainBounds.width * toUnitGridPosition(slot.column, input.latticeColumns),
    y: input.domainBounds.y + input.domainBounds.height * toUnitGridPosition(slot.row, input.latticeRows)
  }));

const createSurfaceGridPoints = (input: {
  readonly domainBounds: RectDto;
  readonly columns: number;
  readonly rows: number;
}): Vec2Dto[] => {
  const points: Vec2Dto[] = [];

  for (let row = 0; row < input.rows; row += 1) {
    for (let column = 0; column < input.columns; column += 1) {
      points.push({
        x: input.domainBounds.x + input.domainBounds.width * toUnitGridPosition(column, input.columns),
        y: input.domainBounds.y + input.domainBounds.height * toUnitGridPosition(row, input.rows)
      });
    }
  }

  return points;
};

const createCreateWarpDeformerResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly mutation: CreateWarpDeformerMutation;
}): OperationResultDto => {
  const rigControl = getCreatedWarpDeformerRigControl(input.mutation);
  const rigControlTarget: TargetRefDto = {
    kind: "rigControl",
    id: rigControl.rigControlId
  };
  const parentTarget = getParentTarget(input.mutation);
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
    changed: createCreateWarpDeformerChanges({
      packageId: input.packageId,
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

const createCreateWarpDeformerChanges = (input: {
  readonly packageId: string;
  readonly mutation: CreateWarpDeformerMutation;
}): ModelDiffDto["changed"] => {
  const rigControl = getCreatedWarpDeformerRigControl(input.mutation);
  const rigControlPath = `/model/rigControls/rigControls/${rigControl.rigControlId}`;
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
          after: rigControl.rigControlId
        }
      ]
    },
    {
      target: {
        kind: "rigControl",
        id: rigControl.rigControlId
      },
      fields: [
        {
          path: rigControlPath,
          before: null,
          after: toJsonValue(rigControl)
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

  for (const childDrawableId of rigControl.childDrawableIds) {
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

const getCreatedWarpDeformerRigControl = (
  mutation: CreateWarpDeformerMutation
): PackageWarpLattice2dRigControl =>
  mutation.mode === "create"
    ? mutation.createMutation.rigControl
    : mutation.mode === "insert"
      ? mutation.insertMutation.rigControl as PackageWarpLattice2dRigControl
      : mutation.wrapMutation.rigControl as PackageWarpLattice2dRigControl;

const getCreatedChildRigControlChanges = (mutation: CreateWarpDeformerMutation) =>
  mutation.mode === "create"
    ? mutation.createMutation.childRigControlChanges
    : mutation.mode === "insert"
      ? mutation.insertMutation.childRigControlChange === undefined
        ? []
        : [mutation.insertMutation.childRigControlChange]
      : mutation.wrapMutation.childRigControlChanges;

const getParentTarget = (mutation: CreateWarpDeformerMutation): TargetRefDto | undefined => {
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
  mutation: CreateWarpDeformerMutation
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

const rootIdsChanged = (mutation: CreateWarpDeformerMutation): boolean =>
  JSON.stringify(mutation.rigControlRootIdsBefore) !== JSON.stringify(mutation.rigControlRootIdsAfter);

const createCreateWarpDeformerMutationDiagnostic = (
  error: AuthoringMutationError,
  rigControl: PackageWarpLattice2dRigControl
): DiagnosticDto => {
  const target = { kind: "rigControl" as const, id: rigControl.rigControlId };

  switch (error.code) {
    case "duplicate_rig_control":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.duplicateRigControl",
        message: error.message,
        target
      });
    case "missing_drawable":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.missingChildDrawable",
        message: error.message,
        target: { ...target, path: "/payload/childDrawableIds" }
      });
    case "missing_rig_control":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.missingRigControl",
        message: error.message,
        target: { ...target, path: "/payload/parentRigControlId" }
      });
    case "duplicate_rig_control_child":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.duplicateChild",
        message: error.message,
        target
      });
    case "duplicate_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.duplicateBinding",
        message: error.message,
        target
      });
    case "missing_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.missingInsertionChildBinding",
        message: error.message,
        target
      });
    case "rig_control_parent_child_mismatch":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.parentChildMismatch",
        message: error.message,
        target
      });
    case "rig_control_self_child":
    case "rig_control_cycle":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.cycle",
        message: error.message,
        target
      });
    case "rig_control_child_already_parented":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.childAlreadyParented",
        message: error.message,
        target
      });
    case "invalid_warp_lattice_domain_bounds":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.invalidDomainBounds",
        message: error.message,
        target: { ...target, path: "/payload/domainBounds" }
      });
    case "invalid_warp_lattice_grid":
    case "invalid_warp_deformer_transform_grid":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.invalidTransformGrid",
        message: error.message,
        target: { ...target, path: "/payload/transformGrid" }
      });
    case "invalid_warp_lattice_rest_control_points":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.invalidRestControlPoints",
        message: error.message,
        target: { ...target, path: "/payload/domainBounds" }
      });
    case "invalid_warp_deformer_bezier_surface":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.invalidBezierSurface",
        message: error.message,
        target: { ...target, path: "/payload/bezierEditSurface" }
      });
    case "invalid_rig_control_opacity_multiplier":
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.invalidOpacityMultiplier",
        message: error.message,
        target: { ...target, path: "/payload/opacityMultiplier" }
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.createWarpDeformer.authoringMutationFailed",
        message: error.message,
        target
      });
  }
};

const createCreateWarpDeformerTargetIds = (
  request: CreateWarpDeformerRequest,
  rigControlId: RigControlId,
  mutation?: CreateWarpDeformerMutation
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
  request: CreateWarpDeformerRequest
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
  mutation: CreateWarpDeformerMutation | undefined
): readonly RigControlId[] => {
  if (mutation?.mode !== "wrap" || mutation.wrapMutation.parentRigControlAfter === undefined) {
    return [];
  }

  return [mutation.wrapMutation.parentRigControlAfter.rigControlId];
};

const toUnitGridPosition = (index: number, size: number): number =>
  size <= 1 ? 0 : index / (size - 1);

const sameOrderedIds = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
