import {
  createDryRunAuthoringSession,
  getDrawableById,
  getPartById,
  setDrawablePart
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DrawableId,
  ModelDiffDto,
  OperationId,
  PartId,
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

export const setDrawablePartOperationHandler: OperationHandler = {
  operationType: "setDrawablePart",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applySetDrawablePart(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applySetDrawablePart(session, request, operationId, "committed");
  }
};

const applySetDrawablePart = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "setDrawablePart") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.setDrawablePart.unsupportedPayload",
            message: `setDrawablePart handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const checkedTargetRefs = createSetDrawablePartCheckedTargetRefs(session, request);
  const targetIds = checkedTargetRefs.map((target) => target.id);
  const diagnostics = evaluateSetDrawablePartPreconditions(session, request, checkedTargetRefs);
  if (diagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const mutation = setDrawablePart(session, {
    drawableId: request.payload.drawableId,
    partId: request.payload.partId
  });

  return {
    result: createSetDrawablePartResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      mutation,
      checkedTargetRefs
    }),
    targetIds,
    candidateSession: session
  };
};

const evaluateSetDrawablePartPreconditions = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "setDrawablePart" }>,
  checkedTargetRefs: readonly TargetRefDto[]
): DiagnosticDto[] => {
  const drawableTarget = createDrawableTarget(request.payload.drawableId);
  const partTarget = createPartTarget(request.payload.partId);
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "setDrawablePart",
      lockedTargetIds: request.payload.lockedTargetIds,
      targets: checkedTargetRefs
    })
  ];
  const drawable = getDrawableById(session.graph, request.payload.drawableId);
  const nextPart = getPartById(session.graph, request.payload.partId);

  if (drawable === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setDrawablePart.missingDrawable",
        message: `Drawable does not exist: ${request.payload.drawableId}.`,
        target: drawableTarget
      })
    );
  }

  if (nextPart === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setDrawablePart.missingPart",
        message: `Part does not exist: ${request.payload.partId}.`,
        target: partTarget
      })
    );
  }

  if (drawable !== undefined && nextPart !== undefined) {
    const currentMembershipCount = nextPart.drawableIds.filter(
      (drawableId) => drawableId === request.payload.drawableId
    ).length;
    if (drawable.partId === request.payload.partId && currentMembershipCount === 1) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.setDrawablePart.noOp",
          message: `Drawable ${drawable.drawableId} already belongs to part ${nextPart.partId}.`,
          target: drawableTarget,
          severity: "warning"
        })
      );
    }
  }

  return diagnostics;
};

const createSetDrawablePartResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: ReturnType<typeof setDrawablePart>;
  readonly checkedTargetRefs: readonly TargetRefDto[];
}): OperationResultDto => {
  const drawableTarget = createDrawableTarget(input.mutation.drawableAfter.drawableId);
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: drawableTarget,
        fields:
          input.mutation.drawableBefore.partId === input.mutation.drawableAfter.partId
            ? []
            : [
                {
                  path: `/model/drawables/${drawableTarget.id}/partId`,
                  before: input.mutation.drawableBefore.partId,
                  after: input.mutation.drawableAfter.partId
                }
              ]
      },
      ...createPartMembershipChanges(input.mutation)
    ].filter((change) => change.fields.length > 0),
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], input.checkedTargetRefs),
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

const createPartMembershipChanges = (mutation: ReturnType<typeof setDrawablePart>) => {
  const previousPartChange =
    mutation.previousPartBefore === undefined || mutation.previousPartAfter === undefined
      ? undefined
      : createPartDrawableIdsChange(mutation.previousPartBefore, mutation.previousPartAfter);
  const nextPartChange = createPartDrawableIdsChange(mutation.nextPartBefore, mutation.nextPartAfter);

  if (previousPartChange === undefined) {
    return [nextPartChange];
  }

  if (previousPartChange.target.id === nextPartChange.target.id) {
    return [nextPartChange];
  }

  return [previousPartChange, nextPartChange];
};

const createPartDrawableIdsChange = (before: ModelPart, after: ModelPart) => ({
  target: createPartTarget(after.partId),
  fields: [
    {
      path: `/model/graph/parts/${after.partId}/drawableIds`,
      before: before.drawableIds,
      after: after.drawableIds
    }
  ]
});

const createSetDrawablePartCheckedTargetRefs = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "setDrawablePart" }>
): readonly TargetRefDto[] => {
  const refs = [createDrawableTarget(request.payload.drawableId), createPartTarget(request.payload.partId)];
  const drawable = getDrawableById(session.graph, request.payload.drawableId);
  if (drawable !== undefined) {
    refs.push(createPartTarget(drawable.partId));
  }

  return uniqueTargetRefs(refs);
};

const uniqueTargetRefs = (refs: readonly TargetRefDto[]): readonly TargetRefDto[] => {
  const seen = new Set<string>();
  const unique: TargetRefDto[] = [];
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.id}:${ref.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(ref);
  }

  return unique;
};

const createDrawableTarget = (drawableId: DrawableId | string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});

const createPartTarget = (partId: PartId | string): TargetRefDto => ({
  kind: "part",
  id: partId
});

type ModelPart = AuthoringSession["graph"]["parts"][number];
