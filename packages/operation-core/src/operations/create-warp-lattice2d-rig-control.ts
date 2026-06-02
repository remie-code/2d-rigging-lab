import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  createWarpLattice2dRigControl
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  createWarpLattice2dControlPointSlots
} from "@private-2d-rigging-lab/contracts";
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

type CreateWarpLattice2dRigControlRequest = Extract<
  OperationRequestDto,
  { operationType: "createWarpLattice2dRigControl" }
>;
type PackageWarpLattice2dRigControl = Parameters<typeof createWarpLattice2dRigControl>[1];
type CreateWarpLattice2dRigControlMutation = ReturnType<typeof createWarpLattice2dRigControl>;

export const createWarpLattice2dRigControlOperationHandler: OperationHandler = {
  operationType: "createWarpLattice2dRigControl",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyCreateWarpLattice2dRigControl(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyCreateWarpLattice2dRigControl(session, request, operationId, "committed");
  }
};

const applyCreateWarpLattice2dRigControl = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "createWarpLattice2dRigControl") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.createWarpLattice2dRigControl.unsupportedPayload",
            message: `createWarpLattice2dRigControl handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const rigControlId = createRigControlIdFromDisplayName(request.payload.displayName);
  const rigControl = createPackageWarpLattice2dRigControl(request, rigControlId);
  const targetIds = createCreateWarpLattice2dRigControlTargetIds(request, rigControlId);
  const baseRevision = session.authoringRevision;

  try {
    const mutation = createWarpLattice2dRigControl(session, rigControl);
    const result = createCreateWarpLattice2dRigControlResult({
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
        diagnostics: [createCreateWarpLattice2dRigControlMutationDiagnostic(error, rigControl)]
      }),
      targetIds,
      candidateSession: session
    };
  }
};

const createPackageWarpLattice2dRigControl = (
  request: CreateWarpLattice2dRigControlRequest,
  rigControlId: RigControlId
): PackageWarpLattice2dRigControl => ({
  kind: "warpLattice2d",
  rigControlId,
  displayName: request.payload.displayName,
  partId: request.payload.partId,
  childDrawableIds: [...request.payload.childDrawableIds],
  childRigControlIds: [...request.payload.childRigControlIds],
  bindSpace: "rigControlLocalRest",
  domainBounds: structuredClone(request.payload.domainBounds),
  latticeColumns: request.payload.latticeColumns,
  latticeRows: request.payload.latticeRows,
  restControlPoints: createRestControlPoints({
    domainBounds: request.payload.domainBounds,
    latticeColumns: request.payload.latticeColumns,
    latticeRows: request.payload.latticeRows
  }),
  interpolationMethod: request.payload.interpolationMethod,
  enabled: true
});

const createCreateWarpLattice2dRigControlResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly mutation: CreateWarpLattice2dRigControlMutation;
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
    changed: createCreateWarpLattice2dRigControlChanges({
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

const createCreateWarpLattice2dRigControlChanges = (input: {
  readonly packageId: string;
  readonly rigControl: PackageWarpLattice2dRigControl;
  readonly mutation: CreateWarpLattice2dRigControlMutation;
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

const createRestControlPoints = (input: {
  readonly domainBounds: RectDto;
  readonly latticeColumns: number;
  readonly latticeRows: number;
}): Vec2Dto[] =>
  createWarpLattice2dControlPointSlots(input).map((slot) => ({
    x: input.domainBounds.x + input.domainBounds.width * toUnitGridPosition(slot.column, input.latticeColumns),
    y: input.domainBounds.y + input.domainBounds.height * toUnitGridPosition(slot.row, input.latticeRows)
  }));

const toUnitGridPosition = (index: number, size: number): number =>
  size <= 1 ? 0 : index / (size - 1);

const rootIdsChanged = (mutation: CreateWarpLattice2dRigControlMutation): boolean =>
  JSON.stringify(mutation.rigControlRootIdsBefore) !== JSON.stringify(mutation.rigControlRootIdsAfter);

const createCreateWarpLattice2dRigControlMutationDiagnostic = (
  error: AuthoringMutationError,
  rigControl: PackageWarpLattice2dRigControl
): DiagnosticDto => {
  switch (error.code) {
    case "duplicate_rig_control":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.duplicateRigControl",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    case "missing_part":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.missingPart",
        message: error.message,
        target: { kind: "part", id: rigControl.partId }
      });
    case "missing_drawable":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.missingChildDrawable",
        message: error.message,
        target: {
          kind: "rigControl",
          id: rigControl.rigControlId,
          path: "/payload/childDrawableIds"
        }
      });
    case "missing_rig_control":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.missingChildRigControl",
        message: error.message,
        target: {
          kind: "rigControl",
          id: rigControl.rigControlId,
          path: "/payload/childRigControlIds"
        }
      });
    case "duplicate_rig_control_child":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.duplicateChild",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    case "rig_control_self_child":
    case "rig_control_cycle":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.cycle",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    case "rig_control_child_already_parented":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.childAlreadyParented",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
    case "invalid_warp_lattice_domain_bounds":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.invalidDomainBounds",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId, path: "/payload/domainBounds" }
      });
    case "invalid_warp_lattice_grid":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.invalidGrid",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId, path: "/payload/lattice" }
      });
    case "invalid_warp_lattice_rest_control_points":
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.invalidRestControlPoints",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId, path: "/payload/domainBounds" }
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.createWarpLattice2dRigControl.authoringMutationFailed",
        message: error.message,
        target: { kind: "rigControl", id: rigControl.rigControlId }
      });
  }
};

const createCreateWarpLattice2dRigControlTargetIds = (
  request: CreateWarpLattice2dRigControlRequest,
  rigControlId: RigControlId
): readonly string[] =>
  [
    rigControlId,
    request.payload.partId,
    ...request.payload.childDrawableIds,
    ...request.payload.childRigControlIds
  ].filter((targetId, index, targetIds) => targetIds.indexOf(targetId) === index);

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
