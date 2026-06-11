import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";
import type { DrawOrderEntryDto, ModelPartChildEntryDto, ModelPartDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export type PartChildEntry = ModelPartChildEntryDto;

export const createPartChildEntry = (partId: PartId): PartChildEntry => ({
  kind: "part",
  partId
});

export const createDrawableChildEntry = (drawableId: DrawableId): PartChildEntry => ({
  kind: "drawable",
  drawableId
});

export const getPartOrderedChildren = (
  graph: AuthoringGraph,
  part: ModelPartDto
): readonly PartChildEntry[] => {
  const baseChildren =
    part.children === undefined
      ? createLegacyOrderedChildren(graph, part)
      : normalizeStoredChildren(part.children, part);
  return appendMissingMembershipChildren(graph, part, baseChildren);
};

export const ensurePartOrderedChildren = (
  graph: AuthoringGraph,
  part: ModelPartDto
): void => {
  setPartOrderedChildren(part, getPartOrderedChildren(graph, part));
};

export const setPartOrderedChildren = (
  part: ModelPartDto,
  children: readonly PartChildEntry[]
): void => {
  const normalized = uniqueChildren(children);
  part.children = normalized.map(cloneChildEntry);
  part.childPartIds = normalized.flatMap((child) => child.kind === "part" ? [child.partId] : []);
  part.drawableIds = normalized.flatMap((child) =>
    child.kind === "drawable" ? [child.drawableId] : []
  );
};

export const appendPartOrderedChild = (
  graph: AuthoringGraph,
  part: ModelPartDto,
  child: PartChildEntry
): void => {
  setPartOrderedChildren(part, [...getPartOrderedChildren(graph, part), child]);
};

export const removePartOrderedChild = (
  graph: AuthoringGraph,
  part: ModelPartDto,
  child: PartChildEntry
): void => {
  setPartOrderedChildren(
    part,
    getPartOrderedChildren(graph, part).filter((candidate) => !partChildEntriesEqual(candidate, child))
  );
};

export const insertPartOrderedChild = (
  graph: AuthoringGraph,
  part: ModelPartDto,
  child: PartChildEntry,
  index: number
): void => {
  const withoutChild = getPartOrderedChildren(graph, part).filter(
    (candidate) => !partChildEntriesEqual(candidate, child)
  );
  const safeIndex = Math.max(0, Math.min(index, withoutChild.length));
  setPartOrderedChildren(part, [
    ...withoutChild.slice(0, safeIndex),
    child,
    ...withoutChild.slice(safeIndex)
  ]);
};

export const findPartOrderedChildIndex = (
  graph: AuthoringGraph,
  part: ModelPartDto,
  child: PartChildEntry
): number =>
  getPartOrderedChildren(graph, part).findIndex((candidate) =>
    partChildEntriesEqual(candidate, child)
  );

export const partChildEntriesEqual = (
  left: PartChildEntry,
  right: PartChildEntry
): boolean =>
  left.kind === right.kind &&
  (left.kind === "part" ? left.partId === (right as Extract<PartChildEntry, { kind: "part" }>).partId : left.drawableId === (right as Extract<PartChildEntry, { kind: "drawable" }>).drawableId);

export const createStructureDrawOrderIndex = (
  graph: AuthoringGraph
): ReadonlyMap<DrawableId, number> =>
  new Map(flattenDrawableIdsByPartOrder(graph).map((drawableId, index) => [drawableId, index]));

export const flattenDrawableIdsByPartOrder = (graph: AuthoringGraph): readonly DrawableId[] => {
  const partsById = new Map(graph.parts.map((part) => [part.partId, part]));
  const existingDrawableIds = new Set(graph.drawables.map((drawable) => drawable.drawableId));
  const stableOrderIndex = createStableOrderIndex(graph.stableOrder);
  const rootParts = graph.parts
    .filter((part) => part.parentPartId === undefined)
    .sort((left, right) => compareStableIds(left.partId, right.partId, stableOrderIndex));
  const visitedParts = new Set<string>();
  const visitedDrawables = new Set<string>();
  const flattened: DrawableId[] = [];

  const visitPart = (part: ModelPartDto): void => {
    if (visitedParts.has(part.partId)) {
      return;
    }

    visitedParts.add(part.partId);
    for (const child of getPartOrderedChildren(graph, part)) {
      if (child.kind === "drawable") {
        if (existingDrawableIds.has(child.drawableId) && !visitedDrawables.has(child.drawableId)) {
          visitedDrawables.add(child.drawableId);
          flattened.push(child.drawableId);
        }
        continue;
      }

      const childPart = partsById.get(child.partId);
      if (childPart !== undefined) {
        visitPart(childPart);
      }
    }
  };

  for (const rootPart of rootParts) {
    visitPart(rootPart);
  }

  for (const drawableId of getDrawableIdsByGlobalDrawOrder(graph)) {
    if (!visitedDrawables.has(drawableId)) {
      flattened.push(drawableId);
    }
  }

  return flattened;
};

export const syncDrawOrderToPartOrder = (
  graph: AuthoringGraph
): {
  readonly drawOrderBefore: readonly DrawOrderEntryDto[];
  readonly drawOrderAfter: readonly DrawOrderEntryDto[];
  readonly drawableChanges: readonly {
    readonly drawableId: DrawableId;
    readonly before: number;
    readonly after: number;
  }[];
} => {
  const drawOrderBefore = structuredClone(graph.drawOrder);
  const drawablesById = new Map(graph.drawables.map((drawable) => [drawable.drawableId, drawable]));
  const existingEntries = new Map(graph.drawOrder.map((entry) => [entry.drawableId, entry]));
  const drawableChanges: {
    readonly drawableId: DrawableId;
    readonly before: number;
    readonly after: number;
  }[] = [];
  const orderedDrawableIds = flattenDrawableIdsByPartOrder(graph);

  graph.drawOrder = orderedDrawableIds.map((drawableId, index) => {
    const drawable = drawablesById.get(drawableId);
    if (drawable !== undefined && drawable.baseDrawOrder !== index) {
      drawableChanges.push({
        drawableId,
        before: drawable.baseDrawOrder,
        after: index
      });
      drawable.baseDrawOrder = index;
    }

    const existing = existingEntries.get(drawableId);
    return {
      drawableId,
      baseDrawOrder: index,
      stableOrder: index,
      ...(existing?.keyformSetId === undefined ? {} : { keyformSetId: existing.keyformSetId })
    };
  });

  return {
    drawOrderBefore,
    drawOrderAfter: structuredClone(graph.drawOrder),
    drawableChanges
  };
};

export const syncDrawableChildrenToDrawOrder = (graph: AuthoringGraph): void => {
  const drawOrderIndex = createDrawOrderIndex(graph.drawOrder);

  for (const part of graph.parts) {
    const children = getPartOrderedChildren(graph, part);
    const sortedDrawableChildren = children
      .filter((child): child is Extract<PartChildEntry, { kind: "drawable" }> => child.kind === "drawable")
      .sort((left, right) => {
        const orderDelta =
          (drawOrderIndex.get(left.drawableId) ?? Number.MAX_SAFE_INTEGER) -
          (drawOrderIndex.get(right.drawableId) ?? Number.MAX_SAFE_INTEGER);
        if (orderDelta !== 0) {
          return orderDelta;
        }

        return left.drawableId.localeCompare(right.drawableId);
      });
    let drawableIndex = 0;
    setPartOrderedChildren(
      part,
      children.map((child) => {
        if (child.kind === "part") {
          return child;
        }

        const replacement = sortedDrawableChildren[drawableIndex];
        drawableIndex += 1;
        return replacement ?? child;
      })
    );
  }
};

const createLegacyOrderedChildren = (
  graph: AuthoringGraph,
  part: ModelPartDto
): readonly PartChildEntry[] => {
  const drawOrderIndex = createDrawOrderIndex(graph.drawOrder);
  const stableOrderIndex = createStableOrderIndex(graph.stableOrder);
  const partsById = new Map(graph.parts.map((candidate) => [candidate.partId, candidate]));
  const children = [
    ...part.childPartIds.map((partId) => ({
      child: createPartChildEntry(partId),
      order: getLegacyPartBlockOrder(partsById, drawOrderIndex, partId, new Set<string>()),
      stableId: partId
    })),
    ...part.drawableIds.map((drawableId) => ({
      child: createDrawableChildEntry(drawableId),
      order: drawOrderIndex.get(drawableId) ?? Number.MAX_SAFE_INTEGER,
      stableId: drawableId
    }))
  ];

  return children
    .sort((left, right) => {
      const orderDelta = left.order - right.order;
      if (orderDelta !== 0) {
        return orderDelta;
      }

      return compareStableIds(left.stableId, right.stableId, stableOrderIndex);
    })
    .map((entry) => entry.child);
};

const getLegacyPartBlockOrder = (
  partsById: ReadonlyMap<PartId, ModelPartDto>,
  drawOrderIndex: ReadonlyMap<DrawableId, number>,
  partId: PartId,
  visitingPartIds: Set<string>
): number => {
  if (visitingPartIds.has(partId)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const part = partsById.get(partId);
  if (part === undefined) {
    return Number.MAX_SAFE_INTEGER;
  }

  visitingPartIds.add(partId);
  const directDrawableOrders = part.drawableIds.map(
    (drawableId) => drawOrderIndex.get(drawableId) ?? Number.MAX_SAFE_INTEGER
  );
  const childPartOrders = part.childPartIds.map((childPartId) =>
    getLegacyPartBlockOrder(partsById, drawOrderIndex, childPartId, visitingPartIds)
  );
  visitingPartIds.delete(partId);

  return Math.min(...directDrawableOrders, ...childPartOrders, Number.MAX_SAFE_INTEGER);
};

const createLegacyDrawableChildren = (
  graph: AuthoringGraph,
  part: ModelPartDto
): readonly PartChildEntry[] => {
  const drawOrderIndex = createDrawOrderIndex(graph.drawOrder);
  return [...part.drawableIds]
    .sort((left, right) => {
      const orderDelta =
        (drawOrderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (drawOrderIndex.get(right) ?? Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) {
        return orderDelta;
      }

      return left.localeCompare(right);
    })
    .map(createDrawableChildEntry);
};

const normalizeStoredChildren = (
  children: readonly PartChildEntry[],
  part: ModelPartDto
): readonly PartChildEntry[] => {
  const knownPartIds = new Set(part.childPartIds);
  const knownDrawableIds = new Set(part.drawableIds);
  return uniqueChildren(children).filter((child) =>
    child.kind === "part" ? knownPartIds.has(child.partId) : knownDrawableIds.has(child.drawableId)
  );
};

const appendMissingMembershipChildren = (
  graph: AuthoringGraph,
  part: ModelPartDto,
  children: readonly PartChildEntry[]
): readonly PartChildEntry[] => {
  const existingKeys = new Set(children.map(createChildKey));
  const missingPartChildren = part.childPartIds
    .map(createPartChildEntry)
    .filter((child) => !existingKeys.has(createChildKey(child)));
  const missingDrawableChildren = createLegacyDrawableChildren(graph, {
    ...part,
    childPartIds: [],
    drawableIds: part.drawableIds.filter((drawableId) => !existingKeys.has(`drawable:${drawableId}`))
  });

  return [...children, ...missingPartChildren, ...missingDrawableChildren];
};

const uniqueChildren = (children: readonly PartChildEntry[]): readonly PartChildEntry[] => {
  const seen = new Set<string>();
  const unique: PartChildEntry[] = [];
  for (const child of children) {
    const key = createChildKey(child);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(cloneChildEntry(child));
  }

  return unique;
};

const cloneChildEntry = (child: PartChildEntry): PartChildEntry =>
  child.kind === "part" ? createPartChildEntry(child.partId) : createDrawableChildEntry(child.drawableId);

const createChildKey = (child: PartChildEntry): string =>
  child.kind === "part" ? `part:${child.partId}` : `drawable:${child.drawableId}`;

const createDrawOrderIndex = (
  drawOrder: readonly DrawOrderEntryDto[]
): ReadonlyMap<DrawableId, number> =>
  new Map(drawOrder.map((entry) => [entry.drawableId, entry.stableOrder]));

const getDrawableIdsByGlobalDrawOrder = (graph: AuthoringGraph): readonly DrawableId[] => {
  const drawOrderIndex = createDrawOrderIndex(graph.drawOrder);
  return graph.drawables
    .map((drawable) => drawable.drawableId)
    .sort((left, right) => {
      const orderDelta =
        (drawOrderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (drawOrderIndex.get(right) ?? Number.MAX_SAFE_INTEGER);
      if (orderDelta !== 0) {
        return orderDelta;
      }

      return left.localeCompare(right);
    });
};

const createStableOrderIndex = (stableOrder: readonly string[]): ReadonlyMap<string, number> =>
  new Map(stableOrder.map((stableId, index) => [stableId, index]));

const compareStableIds = (
  left: string,
  right: string,
  stableOrderIndex: ReadonlyMap<string, number>
): number => {
  const stableDelta =
    (stableOrderIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
    (stableOrderIndex.get(right) ?? Number.MAX_SAFE_INTEGER);
  if (stableDelta !== 0) {
    return stableDelta;
  }

  return left.localeCompare(right);
};
