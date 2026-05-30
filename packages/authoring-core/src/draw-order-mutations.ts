import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import type { DrawOrderEntryDto, DrawableDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringGraph } from "./authoring-graph.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById } from "./drawable-selectors.js";

export const createNextDrawOrderEntry = (
  graph: AuthoringGraph,
  drawableId: DrawableId
): DrawOrderEntryDto => {
  const nextOrder = nextDrawOrderValue(graph.drawOrder);

  return {
    drawableId,
    baseDrawOrder: nextOrder,
    stableOrder: nextOrder
  };
};

export const addDrawOrderEntry = (
  graph: AuthoringGraph,
  entry: DrawOrderEntryDto
): void => {
  graph.drawOrder.push(structuredClone(entry));
};

export interface DrawOrderUpdateInput {
  readonly drawableId: DrawableId;
  readonly baseDrawOrder: number;
}

export interface DrawOrderMutationResult {
  readonly session: AuthoringSession;
  readonly drawableChanges: readonly {
    readonly before: DrawableDto;
    readonly after: DrawableDto;
  }[];
  readonly drawOrderBefore: readonly DrawOrderEntryDto[];
  readonly drawOrderAfter: readonly DrawOrderEntryDto[];
  readonly authoringRevision: AuthoringRevision;
}

export const setDrawableDrawOrders = (
  session: AuthoringSession,
  updates: readonly DrawOrderUpdateInput[]
): DrawOrderMutationResult => {
  assertUniqueUpdateDrawableIds(updates);
  const drawOrderBefore = structuredClone(session.graph.drawOrder);
  const drawablesBefore = new Map(
    updates.map((update) => {
      const drawable = getDrawableById(session.graph, update.drawableId);
      if (drawable === undefined) {
        throw new AuthoringMutationError(
          "missing_drawable",
          `Drawable does not exist: ${update.drawableId}.`
        );
      }

      const entries = session.graph.drawOrder.filter((entry) => entry.drawableId === update.drawableId);
      if (entries.length === 0) {
        throw new AuthoringMutationError(
          "missing_draw_order_entry",
          `Drawable ${update.drawableId} has no draw order entry.`
        );
      }

      if (entries.length > 1) {
        throw new AuthoringMutationError(
          "duplicate_draw_order_entry",
          `Drawable ${update.drawableId} has duplicate draw order entries.`
        );
      }

      return [update.drawableId, structuredClone(drawable)] as const;
    })
  );
  const projectedDrawOrder = structuredClone(drawOrderBefore);

  for (const update of updates) {
    const projectedEntry = projectedDrawOrder.find((entry) => entry.drawableId === update.drawableId);
    if (projectedEntry === undefined) {
      throw new Error(`Expected draw order preflight to resolve ${update.drawableId}.`);
    }

    projectedEntry.baseDrawOrder = update.baseDrawOrder;
  }

  normalizeStableDrawOrderEntries(projectedDrawOrder);
  const drawableBaseOrderWillChange = updates.some(
    (update) => drawablesBefore.get(update.drawableId)?.baseDrawOrder !== update.baseDrawOrder
  );
  if (drawOrderEntriesEqual(drawOrderBefore, projectedDrawOrder) && !drawableBaseOrderWillChange) {
    throw new AuthoringMutationError(
      "no_op_draw_order_update",
      "Requested draw order is already applied."
    );
  }

  for (const update of updates) {
    const drawable = getDrawableById(session.graph, update.drawableId);
    const drawOrderEntry = session.graph.drawOrder.find((entry) => entry.drawableId === update.drawableId);

    if (drawable === undefined || drawOrderEntry === undefined) {
      throw new Error(`Expected draw order preflight to resolve ${update.drawableId}.`);
    }

    drawable.baseDrawOrder = update.baseDrawOrder;
    drawOrderEntry.baseDrawOrder = update.baseDrawOrder;
  }

  normalizeStableDrawOrderEntries(session.graph.drawOrder);
  const drawOrderAfter = structuredClone(session.graph.drawOrder);

  const drawableChanges = updates
    .map((update) => {
      const before = drawablesBefore.get(update.drawableId);
      const after = getDrawableById(session.graph, update.drawableId);
      if (before === undefined || after === undefined) {
        throw new Error(`Expected drawable change state for ${update.drawableId}.`);
      }

      return {
        before,
        after: structuredClone(after)
      };
    })
    .filter((change) => change.before.baseDrawOrder !== change.after.baseDrawOrder);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    drawableChanges,
    drawOrderBefore,
    drawOrderAfter,
    authoringRevision: session.authoringRevision
  };
};

const nextDrawOrderValue = (entries: readonly DrawOrderEntryDto[]): number => {
  if (entries.length === 0) {
    return 0;
  }

  return Math.max(...entries.map((entry) => entry.stableOrder)) + 1;
};

const assertUniqueUpdateDrawableIds = (updates: readonly DrawOrderUpdateInput[]): void => {
  const seen = new Set<DrawableId>();

  for (const update of updates) {
    if (seen.has(update.drawableId)) {
      throw new AuthoringMutationError(
        "duplicate_draw_order_entry",
        `Drawable ${update.drawableId} appears more than once in draw order updates.`
      );
    }

    seen.add(update.drawableId);
  }
};

const normalizeStableDrawOrderEntries = (entries: DrawOrderEntryDto[]): void => {
  const previousStableOrder = new Map(
    entries.map((entry, index) => [entry.drawableId, entry.stableOrder ?? index])
  );
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
  left: readonly DrawOrderEntryDto[],
  right: readonly DrawOrderEntryDto[]
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
