import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  updateRigControl
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

type UpdateRigControlRequest = Extract<OperationRequestDto, { operationType: "updateRigControl" }>;
type UpdateRigControlMutation = ReturnType<typeof updateRigControl>;
type UpdatedRigControlDto = UpdateRigControlMutation["rigControlBefore"];

export const updateRigControlOperationHandler: OperationHandler = {
  operationType: "updateRigControl",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyUpdateRigControl(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    const preflight = applyUpdateRigControl(
      createDryRunAuthoringSession(session),
      request,
      operationId,
      "committed"
    );
    if (preflight.result.status !== "committed") {
      return {
        result: preflight.result,
        targetIds: preflight.targetIds,
        candidateSession: session
      };
    }

    return applyUpdateRigControl(session, request, operationId, "committed");
  }
};

const applyUpdateRigControl = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "updateRigControl") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.updateRigControl.unsupportedPayload",
            message: `updateRigControl handler cannot apply ${request.operationType}.`,
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
    const mutation = updateRigControl(session, {
      rigControlId: request.payload.rigControlId,
      ...(request.payload.displayName === undefined ? {} : { displayName: request.payload.displayName }),
      ...(request.payload.domainBounds === undefined ? {} : { domainBounds: request.payload.domainBounds }),
      ...(request.payload.transformColumns === undefined ? {} : { transformColumns: request.payload.transformColumns }),
      ...(request.payload.transformRows === undefined ? {} : { transformRows: request.payload.transformRows }),
      ...(request.payload.bezierColumns === undefined ? {} : { bezierColumns: request.payload.bezierColumns }),
      ...(request.payload.bezierRows === undefined ? {} : { bezierRows: request.payload.bezierRows }),
      ...(request.payload.opacityMultiplier === undefined ? {} : { opacityMultiplier: request.payload.opacityMultiplier })
    });

    return {
      result: createUpdateRigControlResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        mutation
      }),
      targetIds: [mutation.rigControlAfter.rigControlId],
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createUpdateRigControlMutationDiagnostic(error, request)]
      }),
      targetIds: [request.payload.rigControlId],
      candidateSession: session
    };
  }
};

const createUpdateRigControlResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: UpdateRigControlMutation;
}): OperationResultDto => {
  const target: TargetRefDto = {
    kind: "rigControl",
    id: input.mutation.rigControlAfter.rigControlId
  };
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target,
        fields: createRigControlFieldChanges(
          input.mutation.rigControlBefore,
          input.mutation.rigControlAfter
        )
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

const createRigControlFieldChanges = (
  before: UpdatedRigControlDto,
  after: UpdatedRigControlDto
): ModelDiffDto["changed"][number]["fields"] => {
  const basePath = `/model/rigControls/rigControls/${after.rigControlId}`;
  const fields: ModelDiffDto["changed"][number]["fields"] = [];

  addFieldChange(fields, `${basePath}/displayName`, before.displayName, after.displayName);
  addFieldChange(fields, `${basePath}/opacityMultiplier`, before.opacityMultiplier ?? 1, after.opacityMultiplier ?? 1);

  if (before.kind === "warpLattice2d" && after.kind === "warpLattice2d") {
    addFieldChange(fields, `${basePath}/domainBounds`, before.domainBounds, after.domainBounds);
    addFieldChange(fields, `${basePath}/latticeColumns`, before.latticeColumns, after.latticeColumns);
    addFieldChange(fields, `${basePath}/latticeRows`, before.latticeRows, after.latticeRows);
    addFieldChange(fields, `${basePath}/restControlPoints`, before.restControlPoints, after.restControlPoints);
    addFieldChange(
      fields,
      `${basePath}/warpDeformer/transformGrid`,
      before.warpDeformer?.transformGrid ?? null,
      after.warpDeformer?.transformGrid ?? null
    );
    addFieldChange(
      fields,
      `${basePath}/warpDeformer/bezierEditSurface`,
      before.warpDeformer?.bezierEditSurface ?? null,
      after.warpDeformer?.bezierEditSurface ?? null
    );
  }

  return fields;
};

const addFieldChange = (
  fields: ModelDiffDto["changed"][number]["fields"],
  path: string,
  before: unknown,
  after: unknown
): void => {
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return;
  }

  fields.push({
    path,
    before: toJsonValue(before),
    after: toJsonValue(after)
  });
};

const createUpdateRigControlMutationDiagnostic = (
  error: AuthoringMutationError,
  request: UpdateRigControlRequest
): DiagnosticDto => {
  const target: TargetRefDto = {
    kind: "rigControl",
    id: request.payload.rigControlId
  };
  switch (error.code) {
    case "missing_rig_control":
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.missingRigControl",
        message: error.message,
        target
      });
    case "invalid_rig_control_display_name":
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.invalidDisplayName",
        message: error.message,
        target
      });
    case "invalid_rig_control_opacity_multiplier":
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.invalidOpacityMultiplier",
        message: error.message,
        target
      });
    case "unsupported_rig_control_update_field":
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.unsupportedField",
        message: error.message,
        target
      });
    case "invalid_warp_lattice_domain_bounds":
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.invalidDomainBounds",
        message: error.message,
        target: { ...target, path: "/payload/domainBounds" }
      });
    case "invalid_warp_lattice_grid":
    case "invalid_warp_deformer_transform_grid":
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.invalidTransformGrid",
        message: error.message,
        target: { ...target, path: "/payload/transformGrid" }
      });
    case "invalid_warp_deformer_bezier_surface":
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.invalidBezierSurface",
        message: error.message,
        target: { ...target, path: "/payload/bezierEditSurface" }
      });
    case "rig_control_keyform_cardinality_conflict":
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.keyformCardinalityConflict",
        message: error.message,
        target
      });
    case "no_op_rig_control_update":
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.noOp",
        message: error.message,
        target,
        severity: "warning"
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.updateRigControl.authoringMutationFailed",
        message: error.message,
        target
      });
  }
};

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
