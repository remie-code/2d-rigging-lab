import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  getDrawableById,
  updateDrawable
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DrawableId,
  ModelDiffDto,
  OperationId,
  RuntimeDiffDto,
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
import { createLockedTargetDiagnostics } from "./locked-targets.js";

export const updateDrawableOperationHandler: OperationHandler = {
  operationType: "updateDrawable",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyUpdateDrawable(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyUpdateDrawable(session, request, operationId, "committed");
  }
};

const applyUpdateDrawable = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "updateDrawable") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.updateDrawable.unsupportedPayload",
            message: `updateDrawable handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const drawableTarget = createDrawableTarget(request.payload.drawableId);
  const diagnostics = evaluateUpdateDrawablePreconditions(session, request, drawableTarget);
  if (diagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics }),
      targetIds: [request.payload.drawableId],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;

  try {
    const mutation = updateDrawable(session, {
      drawableId: request.payload.drawableId,
      ...(request.payload.displayName === undefined
        ? {}
        : { displayName: request.payload.displayName }),
      ...(request.payload.defaultOpacity === undefined
        ? {}
        : { defaultOpacity: request.payload.defaultOpacity })
    });

    return {
      result: createUpdateDrawableResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        mutation,
        drawableTarget,
        stableDrawOrder:
          session.graph.drawOrder.find(
            (entry) => entry.drawableId === mutation.drawableAfter.drawableId
          )?.stableOrder ?? mutation.drawableAfter.baseDrawOrder
      }),
      targetIds: [request.payload.drawableId],
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createUpdateDrawableMutationDiagnostic(error, operationId)]
      }),
      targetIds: [request.payload.drawableId],
      candidateSession: session
    };
  }
};

const evaluateUpdateDrawablePreconditions = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "updateDrawable" }>,
  drawableTarget: TargetRefDto
): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "updateDrawable",
      lockedTargetIds: request.payload.lockedTargetIds,
      targets: [drawableTarget]
    })
  ];
  const drawable = getDrawableById(session.graph, request.payload.drawableId);

  if (drawable === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.updateDrawable.missingDrawable",
        message: `Drawable does not exist: ${request.payload.drawableId}.`,
        target: drawableTarget
      })
    );
    return diagnostics;
  }

  const displayNameChanged =
    request.payload.displayName !== undefined &&
    request.payload.displayName !== drawable.displayName;
  const opacityChanged =
    request.payload.defaultOpacity !== undefined &&
    request.payload.defaultOpacity !== drawable.defaultOpacity;
  if (diagnostics.length === 0 && !displayNameChanged && !opacityChanged) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.updateDrawable.noOp",
        message: `Drawable ${drawable.drawableId} is already up to date.`,
        target: drawableTarget,
        severity: "warning"
      })
    );
  }

  return diagnostics;
};

const createUpdateDrawableMutationDiagnostic = (
  error: AuthoringMutationError,
  operationId: OperationId
): DiagnosticDto => {
  const checkIdByCode: Partial<Record<AuthoringMutationError["code"], string>> = {
    missing_drawable: "operation.updateDrawable.missingDrawable",
    invalid_drawable_display_name: "operation.updateDrawable.invalidDisplayName",
    invalid_drawable_opacity: "operation.updateDrawable.invalidOpacity",
    no_op_drawable_update: "operation.updateDrawable.noOp"
  };

  return createOperationDiagnostic({
    checkId: checkIdByCode[error.code] ?? "operation.updateDrawable.authoringMutationFailed",
    message: error.message,
    target: { kind: "operation", id: operationId },
    severity: error.code === "no_op_drawable_update" ? "warning" : "error"
  });
};

const createUpdateDrawableResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: ReturnType<typeof updateDrawable>;
  readonly drawableTarget: TargetRefDto;
  readonly stableDrawOrder: number;
}): OperationResultDto => {
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: input.drawableTarget,
        fields: createDrawableFieldChanges(
          input.mutation.drawableBefore,
          input.mutation.drawableAfter
        )
      }
    ].filter((change) => change.fields.length > 0),
    operationIds: [input.operationId]
  };
  const runtimeDiff = createDrawableOpacityRuntimeDiff({
    operationId: input.operationId,
    status: input.status,
    before: input.mutation.drawableBefore,
    after: input.mutation.drawableAfter,
    stableDrawOrder: input.stableDrawOrder
  });

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], [input.drawableTarget]),
    modelDiff,
    runtimeDiff,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds:
      runtimeDiff === undefined ? [] : [runtimeDiff.beforeSnapshotId, runtimeDiff.afterSnapshotId],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    reversible: true
  });
};

const createDrawableFieldChanges = (
  before: AuthoringSession["graph"]["drawables"][number],
  after: AuthoringSession["graph"]["drawables"][number]
): ModelDiffDto["changed"][number]["fields"] => [
  ...(before.displayName === after.displayName
    ? []
    : [
        {
          path: `/model/drawables/${after.drawableId}/displayName`,
          before: before.displayName,
          after: after.displayName
        }
      ]),
  ...(before.defaultOpacity === after.defaultOpacity
    ? []
    : [
        {
          path: `/model/drawables/${after.drawableId}/defaultOpacity`,
          before: before.defaultOpacity,
          after: after.defaultOpacity
        }
      ])
];

const createDrawableOpacityRuntimeDiff = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly before: AuthoringSession["graph"]["drawables"][number];
  readonly after: AuthoringSession["graph"]["drawables"][number];
  readonly stableDrawOrder: number;
}): RuntimeDiffDto | undefined => {
  if (input.before.defaultOpacity === input.after.defaultOpacity) {
    return undefined;
  }

  return {
    schemaVersion: "runtime-diff-v1",
    beforeSnapshotId: `snap_${input.operationId}_before_runtime` as RuntimeDiffDto["beforeSnapshotId"],
    afterSnapshotId: `snap_${input.operationId}_${input.status}_runtime` as RuntimeDiffDto["afterSnapshotId"],
    parameterChanges: [],
    dynamicsChanges: [],
    drawableChanges: [],
    drawableRuntimeStateChanges: [
      {
        drawableId: input.after.drawableId,
        opacityBefore: input.before.defaultOpacity,
        opacityAfter: input.after.defaultOpacity,
        visibleBefore: input.before.runtimeVisibility,
        visibleAfter: input.after.runtimeVisibility,
        baseDrawOrderBefore: input.before.baseDrawOrder,
        baseDrawOrderAfter: input.after.baseDrawOrder,
        evaluatedDrawOrderBefore: input.stableDrawOrder,
        evaluatedDrawOrderAfter: input.stableDrawOrder
      }
    ],
    drawListChanges: [],
    diagnosticDelta: []
  };
};

const createDrawableTarget = (drawableId: DrawableId | string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});
