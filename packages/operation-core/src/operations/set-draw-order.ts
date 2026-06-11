import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  getDrawableById,
  setDrawableDrawOrders
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DrawableId,
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

type DrawOrderEntry = AuthoringSession["graph"]["drawOrder"][number];

export const setDrawOrderOperationHandler: OperationHandler = {
  operationType: "setDrawOrder",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applySetDrawOrder(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applySetDrawOrder(session, request, operationId, "committed");
  }
};

const applySetDrawOrder = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "setDrawOrder") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.setDrawOrder.unsupportedPayload",
            message: `setDrawOrder handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const targetIds = uniqueStrings(request.payload.entries.map((entry) => entry.drawableId));
  const checkedTargets = targetIds.map((drawableId) => createDrawableTarget(drawableId));
  const preconditionDiagnostics = evaluateSetDrawOrderPreconditions(session, request);
  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;

  try {
    const mutation = setDrawableDrawOrders(session, request.payload.entries);

    return {
      result: createSetDrawOrderResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        packageId: session.packageIdentity.packageId,
        drawOrderBefore: mutation.drawOrderBefore,
        drawOrderAfter: mutation.drawOrderAfter,
        drawableChanges: mutation.drawableChanges,
        checkedTargets
      }),
      targetIds,
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    const diagnostic = createSetDrawOrderMutationDiagnostic(error, operationId);
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: [diagnostic] }),
      targetIds,
      candidateSession: session
    };
  }
};

const evaluateSetDrawOrderPreconditions = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "setDrawOrder" }>
): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];
  const seenPayloadDrawableIds = new Set<DrawableId>();

  for (const entry of request.payload.entries) {
    if (seenPayloadDrawableIds.has(entry.drawableId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.setDrawOrder.duplicateEntry",
          message: `Drawable appears more than once in setDrawOrder payload: ${entry.drawableId}.`,
          target: { kind: "drawable", id: entry.drawableId, path: "/payload/entries" }
        })
      );
      continue;
    }

    seenPayloadDrawableIds.add(entry.drawableId);

    if (getDrawableById(session.graph, entry.drawableId) === undefined) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.setDrawOrder.missingDrawable",
          message: `Drawable does not exist: ${entry.drawableId}.`,
          target: createDrawableTarget(entry.drawableId)
        })
      );
    }

    const existingEntries = session.graph.drawOrder.filter(
      (drawOrderEntry) => drawOrderEntry.drawableId === entry.drawableId
    );
    if (existingEntries.length === 0) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.setDrawOrder.missingDrawOrderEntry",
          message: `Drawable has no draw order entry: ${entry.drawableId}.`,
          target: { kind: "drawable", id: entry.drawableId, path: "/model/drawOrder/entries" }
        })
      );
    } else if (existingEntries.length > 1) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.setDrawOrder.duplicateEntry",
          message: `Drawable has duplicate draw order entries: ${entry.drawableId}.`,
          target: { kind: "drawable", id: entry.drawableId, path: "/model/drawOrder/entries" }
        })
      );
    }
  }

  if (diagnostics.length === 0 && isSetDrawOrderNoOp(session, request)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setDrawOrder.noOp",
        message: "Requested draw order is already applied.",
        target: { kind: "package", id: session.packageIdentity.packageId, path: "/model/drawOrder/entries" },
        severity: "warning"
      })
    );
  }

  return diagnostics;
};

const isSetDrawOrderNoOp = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "setDrawOrder" }>
): boolean => {
  const projectedDrawOrder = structuredClone(session.graph.drawOrder);

  for (const update of request.payload.entries) {
    const entry = projectedDrawOrder.find((drawOrderEntry) => drawOrderEntry.drawableId === update.drawableId);
    if (entry === undefined) {
      return false;
    }

    entry.baseDrawOrder = update.baseDrawOrder;
  }

  normalizeStableDrawOrderEntries(projectedDrawOrder);
  const drawableBaseOrderWillChange = request.payload.entries.some(
    (update) => getDrawableById(session.graph, update.drawableId)?.baseDrawOrder !== update.baseDrawOrder
  );

  return drawOrderEntriesEqual(session.graph.drawOrder, projectedDrawOrder) && !drawableBaseOrderWillChange;
};

const createSetDrawOrderMutationDiagnostic = (
  error: AuthoringMutationError,
  operationId: OperationId
): DiagnosticDto => {
  const checkIdByCode: Partial<Record<AuthoringMutationError["code"], string>> = {
    missing_drawable: "operation.setDrawOrder.missingDrawable",
    missing_draw_order_entry: "operation.setDrawOrder.missingDrawOrderEntry",
    duplicate_draw_order_entry: "operation.setDrawOrder.duplicateEntry",
    draw_order_structure_conflict: "operation.setDrawOrder.structureConflict",
    no_op_draw_order_update: "operation.setDrawOrder.noOp"
  };

  return createOperationDiagnostic({
    checkId: checkIdByCode[error.code] ?? "operation.setDrawOrder.authoringMutationFailed",
    message: error.message,
    target: { kind: "operation", id: operationId },
    severity: error.code === "no_op_draw_order_update" ? "warning" : "error"
  });
};

const createSetDrawOrderResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly drawOrderBefore: readonly DrawOrderEntry[];
  readonly drawOrderAfter: readonly DrawOrderEntry[];
  readonly drawableChanges: readonly {
    readonly before: { readonly drawableId: DrawableId; readonly baseDrawOrder: number };
    readonly after: { readonly drawableId: DrawableId; readonly baseDrawOrder: number };
  }[];
  readonly checkedTargets: readonly TargetRefDto[];
}): OperationResultDto => {
  const packageTarget: TargetRefDto = {
    kind: "package",
    id: input.packageId,
    path: "/model/drawOrder/entries"
  };
  const changed: ModelDiffDto["changed"] = [];

  if (!drawOrderEntriesEqual(input.drawOrderBefore, input.drawOrderAfter)) {
    changed.push({
      target: packageTarget,
      fields: [
        {
          path: "/model/drawOrder/entries",
          before: toJsonDrawOrderEntries(input.drawOrderBefore),
          after: toJsonDrawOrderEntries(input.drawOrderAfter)
        }
      ]
    });
  }

  changed.push(
    ...input.drawableChanges.map((change) => ({
      target: createDrawableTarget(change.after.drawableId),
      fields: [
        {
          path: `/model/drawables/${change.after.drawableId}/baseDrawOrder`,
          before: change.before.baseDrawOrder,
          after: change.after.baseDrawOrder
        }
      ]
    }))
  );

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
    precondition: createPreconditionResult([], [packageTarget, ...input.checkedTargets]),
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

const createDrawableTarget = (drawableId: string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});

const toJsonDrawOrderEntries = (entries: readonly DrawOrderEntry[]): JsonValue =>
  entries.map((entry): JsonValue => {
    const jsonEntry: Record<string, JsonValue> = {
      drawableId: entry.drawableId,
      baseDrawOrder: entry.baseDrawOrder,
      stableOrder: entry.stableOrder
    };

    if (entry.keyformSetId !== undefined) {
      jsonEntry.keyformSetId = entry.keyformSetId;
    }

    return jsonEntry;
  });

const uniqueStrings = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};

const normalizeStableDrawOrderEntries = (entries: DrawOrderEntry[]): void => {
  const previousStableOrder = new Map(entries.map((entry, index) => [entry.drawableId, entry.stableOrder ?? index]));
  const normalized = [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const baseDelta = left.entry.baseDrawOrder - right.entry.baseDrawOrder;
      if (baseDelta !== 0) {
        return baseDelta;
      }

      const stableDelta =
        (previousStableOrder.get(left.entry.drawableId) ?? left.index) -
        (previousStableOrder.get(right.entry.drawableId) ?? right.index);
      if (stableDelta !== 0) {
        return stableDelta;
      }

      return left.entry.drawableId.localeCompare(right.entry.drawableId);
    });

  normalized.forEach(({ entry }, stableOrder) => {
    entry.stableOrder = stableOrder;
  });
};

const drawOrderEntriesEqual = (
  left: readonly DrawOrderEntry[],
  right: readonly DrawOrderEntry[]
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
