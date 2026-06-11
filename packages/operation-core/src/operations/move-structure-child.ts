import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  getDrawableById,
  getPartById,
  moveStructureChild
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession, StructureOrderItem } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
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
import { toModelDiffJsonValue } from "./model-diff-json-value.js";

export const moveStructureChildOperationHandler: OperationHandler = {
  operationType: "moveStructureChild",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyMoveStructureChild(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyMoveStructureChild(session, request, operationId, "committed");
  }
};

const applyMoveStructureChild = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "moveStructureChild") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.moveStructureChild.unsupportedPayload",
            message: `moveStructureChild handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const checkedTargetRefs = createMoveCheckedTargetRefs(session, request);
  const targetIds = checkedTargetRefs.map((target) => target.id);
  const diagnostics = evaluateMovePreconditions(session, request, checkedTargetRefs);
  if (diagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  let mutation: ReturnType<typeof moveStructureChild>;
  try {
    mutation = moveStructureChild(session, {
      moved: request.payload.moved,
      drop: request.payload.drop
    });
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createMoveStructureChildMutationDiagnostic(error, operationId)]
      }),
      targetIds,
      candidateSession: session
    };
  }

  return {
    result: createMoveStructureChildResult({
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

const evaluateMovePreconditions = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "moveStructureChild" }>,
  checkedTargetRefs: readonly TargetRefDto[]
): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "moveStructureChild",
      lockedTargetIds: request.payload.lockedTargetIds,
      targets: checkedTargetRefs
    })
  ];
  const movedTarget = createTargetForItem(request.payload.moved);
  const destinationPart = resolveDestinationPart(session, request);

  if (!itemExists(session, request.payload.moved)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId:
          request.payload.moved.kind === "part"
            ? "operation.moveStructureChild.missingPart"
            : "operation.moveStructureChild.missingDrawable",
        message: `Moved ${request.payload.moved.kind} does not exist.`,
        target: movedTarget
      })
    );
    return diagnostics;
  }

  if (request.payload.moved.kind === "part") {
    const part = getPartById(session.graph, request.payload.moved.partId);
    if (part?.parentPartId === undefined) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.moveStructureChild.rootPartMove",
          message: `Root part cannot be moved: ${request.payload.moved.partId}.`,
          target: movedTarget
        })
      );
    }
  }

  if (destinationPart === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.moveStructureChild.missingDestinationPart",
        message: "Destination part does not exist or cannot be resolved.",
        target: { kind: "operation", id: request.operationId ?? "op_move_structure_child" }
      })
    );
    return diagnostics;
  }

  if (request.payload.moved.kind === "part") {
    const movedPartId = request.payload.moved.partId;
    if (destinationPart.partId === movedPartId || isDescendantPart(session, movedPartId, destinationPart.partId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.moveStructureChild.partCycle",
          message: `Part ${movedPartId} cannot be parented by descendant ${destinationPart.partId}.`,
          target: createPartTarget(destinationPart.partId)
        })
      );
    }
  }

  if (
    request.payload.drop.placement !== "inside" &&
    itemsEqual(request.payload.moved, request.payload.drop.target)
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.moveStructureChild.noOp",
        message: "Cannot drop a row onto itself.",
        target: movedTarget,
        severity: "warning"
      })
    );
  }

  return diagnostics;
};

const createMoveStructureChildResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: ReturnType<typeof moveStructureChild>;
  readonly checkedTargetRefs: readonly TargetRefDto[];
}): OperationResultDto => {
  const changed = [
    ...(input.mutation.partBefore === undefined || input.mutation.partAfter === undefined
      ? []
      : [
          {
            target: createPartTarget(input.mutation.partAfter.partId),
            fields: createMovedPartFieldChanges(input.mutation.partBefore, input.mutation.partAfter)
          }
        ]),
    ...(input.mutation.drawableBefore === undefined || input.mutation.drawableAfter === undefined
      ? []
      : [
          {
            target: createDrawableTarget(input.mutation.drawableAfter.drawableId),
            fields: createMovedDrawableFieldChanges(
              input.mutation.drawableBefore,
              input.mutation.drawableAfter
            )
          }
        ]),
    ...createParentChanges(input.mutation),
    ...(drawOrderEntriesEqual(input.mutation.drawOrderBefore, input.mutation.drawOrderAfter) ? [] : [{
      target: { kind: "package", id: input.mutation.session.packageIdentity.packageId } satisfies TargetRefDto,
      fields: [
        {
          path: "/model/drawOrder/entries",
          before: toModelDiffJsonValue(input.mutation.drawOrderBefore),
          after: toModelDiffJsonValue(input.mutation.drawOrderAfter)
        }
      ]
    }])
  ].filter((change) => change.fields.length > 0);
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed,
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

const createParentChanges = (mutation: ReturnType<typeof moveStructureChild>) => {
  const oldParentChange = createParentOrderChange(mutation.oldParentBefore, mutation.oldParentAfter);
  const newParentChange =
    mutation.newParentBefore === undefined || mutation.newParentAfter === undefined
      ? undefined
      : createParentOrderChange(mutation.newParentBefore, mutation.newParentAfter);

  if (newParentChange === undefined) {
    return [oldParentChange];
  }

  return [oldParentChange, newParentChange];
};

const createParentOrderChange = (before: ModelPart, after: ModelPart) => ({
  target: createPartTarget(after.partId),
  fields: [
    {
      path: `/model/graph/parts/${after.partId}/children`,
      before: toModelDiffJsonValue(before.children ?? []),
      after: toModelDiffJsonValue(after.children ?? [])
    },
    {
      path: `/model/graph/parts/${after.partId}/childPartIds`,
      before: before.childPartIds,
      after: after.childPartIds
    },
    {
      path: `/model/graph/parts/${after.partId}/drawableIds`,
      before: before.drawableIds,
      after: after.drawableIds
    }
  ].filter((field) => JSON.stringify(field.before) !== JSON.stringify(field.after))
});

const createMovedPartFieldChanges = (before: ModelPart, after: ModelPart) => [
  ...(before.parentPartId === after.parentPartId
    ? []
    : [
        {
          path: `/model/graph/parts/${after.partId}/parentPartId`,
          before: before.parentPartId ?? null,
          after: after.parentPartId ?? null
        }
      ])
];

const createMovedDrawableFieldChanges = (before: Drawable, after: Drawable) => [
  ...(before.partId === after.partId
    ? []
    : [
        {
          path: `/model/drawables/${after.drawableId}/partId`,
          before: before.partId,
          after: after.partId
        }
      ]),
  ...(before.baseDrawOrder === after.baseDrawOrder
    ? []
    : [
        {
          path: `/model/drawables/${after.drawableId}/baseDrawOrder`,
          before: before.baseDrawOrder,
          after: after.baseDrawOrder
        }
      ])
];

const createMoveStructureChildMutationDiagnostic = (
  error: AuthoringMutationError,
  operationId: OperationId
): DiagnosticDto => {
  const checkIdByCode: Partial<Record<AuthoringMutationError["code"], string>> = {
    missing_part: "operation.moveStructureChild.missingPart",
    missing_drawable: "operation.moveStructureChild.missingDrawable",
    missing_parent_part: "operation.moveStructureChild.missingDestinationPart",
    root_part_move: "operation.moveStructureChild.rootPartMove",
    root_part_drop: "operation.moveStructureChild.missingDestinationPart",
    part_cycle: "operation.moveStructureChild.partCycle",
    no_op_structure_order_move: "operation.moveStructureChild.noOp",
    missing_drop_target: "operation.moveStructureChild.missingDestinationPart"
  };

  return createOperationDiagnostic({
    checkId: checkIdByCode[error.code] ?? "operation.moveStructureChild.authoringMutationFailed",
    message: error.message,
    target: { kind: "operation", id: operationId },
    severity: error.code === "no_op_structure_order_move" ? "warning" : "error"
  });
};

const createMoveCheckedTargetRefs = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "moveStructureChild" }>
): readonly TargetRefDto[] =>
  uniqueTargetRefs([
    createTargetForItem(request.payload.moved),
    ...(request.payload.drop.placement === "inside"
      ? [createPartTarget(request.payload.drop.parentPartId)]
      : [createTargetForItem(request.payload.drop.target)]),
    ...(resolveDestinationPart(session, request) === undefined
      ? []
      : [createPartTarget(resolveDestinationPart(session, request)!.partId)])
  ]);

const resolveDestinationPart = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "moveStructureChild" }>
): ModelPart | undefined => {
  if (request.payload.drop.placement === "inside") {
    return getPartById(session.graph, request.payload.drop.parentPartId);
  }

  const parentPartId = resolveTargetParentPartId(session, request.payload.drop.target);
  return parentPartId === undefined ? undefined : getPartById(session.graph, parentPartId);
};

const resolveTargetParentPartId = (
  session: AuthoringSession,
  target: StructureOrderItem
): PartId | undefined => {
  if (target.kind === "part") {
    return getPartById(session.graph, target.partId)?.parentPartId;
  }

  return getDrawableById(session.graph, target.drawableId)?.partId;
};

const itemExists = (session: AuthoringSession, item: StructureOrderItem): boolean =>
  item.kind === "part"
    ? getPartById(session.graph, item.partId) !== undefined
    : getDrawableById(session.graph, item.drawableId) !== undefined;

const isDescendantPart = (
  session: AuthoringSession,
  ancestorPartId: PartId,
  candidatePartId: PartId
): boolean => {
  const stack = [...(getPartById(session.graph, ancestorPartId)?.childPartIds ?? [])];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const partId = stack.pop();
    if (partId === undefined || seen.has(partId)) {
      continue;
    }

    if (partId === candidatePartId) {
      return true;
    }

    seen.add(partId);
    stack.push(...(getPartById(session.graph, partId)?.childPartIds ?? []));
  }

  return false;
};

const itemsEqual = (left: StructureOrderItem, right: StructureOrderItem): boolean =>
  left.kind === right.kind &&
  (left.kind === "part"
    ? left.partId === (right as Extract<StructureOrderItem, { kind: "part" }>).partId
    : left.drawableId === (right as Extract<StructureOrderItem, { kind: "drawable" }>).drawableId);

const createTargetForItem = (item: StructureOrderItem): TargetRefDto =>
  item.kind === "part" ? createPartTarget(item.partId) : createDrawableTarget(item.drawableId);

const drawOrderEntriesEqual = (
  left: readonly AuthoringSession["graph"]["drawOrder"][number][],
  right: readonly AuthoringSession["graph"]["drawOrder"][number][]
): boolean =>
  left.length === right.length &&
  left.every((leftEntry, index) => {
    const rightEntry = right[index];
    return (
      rightEntry !== undefined &&
      leftEntry.drawableId === rightEntry.drawableId &&
      leftEntry.baseDrawOrder === rightEntry.baseDrawOrder &&
      leftEntry.stableOrder === rightEntry.stableOrder &&
      leftEntry.keyformSetId === rightEntry.keyformSetId
    );
  });

const createPartTarget = (partId: PartId | string): TargetRefDto => ({
  kind: "part",
  id: partId
});

const createDrawableTarget = (drawableId: string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});

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

type ModelPart = AuthoringSession["graph"]["parts"][number];
type Drawable = AuthoringSession["graph"]["drawables"][number];
