import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  DrawOrderEntryDto,
  ModelPartDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";
import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision, type AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById, getPartById } from "./drawable-selectors.js";
import {
  createDrawableChildEntry,
  createPartChildEntry,
  findPartOrderedChildIndex,
  getPartOrderedChildren,
  insertPartOrderedChild,
  partChildEntriesEqual,
  removePartOrderedChild,
  syncDrawOrderToPartOrder,
  type PartChildEntry
} from "./part-children-order.js";

export type StructureOrderItem =
  | {
      readonly kind: "part";
      readonly partId: PartId;
    }
  | {
      readonly kind: "drawable";
      readonly drawableId: DrawableId;
    };

export type StructureOrderDrop =
  | {
      readonly placement: "inside";
      readonly parentPartId: PartId;
    }
  | {
      readonly placement: "before" | "after";
      readonly target: StructureOrderItem;
    };

export interface MoveStructureChildMutationResult {
  readonly session: AuthoringSession;
  readonly moved: StructureOrderItem;
  readonly partBefore?: ModelPartDto;
  readonly partAfter?: ModelPartDto;
  readonly drawableBefore?: DrawableDto;
  readonly drawableAfter?: DrawableDto;
  readonly oldParentBefore: ModelPartDto;
  readonly oldParentAfter: ModelPartDto;
  readonly newParentBefore?: ModelPartDto;
  readonly newParentAfter?: ModelPartDto;
  readonly drawOrderBefore: readonly DrawOrderEntryDto[];
  readonly drawOrderAfter: readonly DrawOrderEntryDto[];
  readonly authoringRevision: AuthoringRevision;
}

interface ResolvedMoveItem {
  readonly moved: StructureOrderItem;
  readonly child: PartChildEntry;
  readonly parent: ModelPartDto;
  readonly part?: ModelPartDto;
  readonly drawable?: DrawableDto;
}

export const moveStructureChild = (
  session: AuthoringSession,
  input: {
    readonly moved: StructureOrderItem;
    readonly drop: StructureOrderDrop;
  }
): MoveStructureChildMutationResult => {
  const moved = resolveMoveItem(session, input.moved);
  const destinationParent = resolveDestinationParent(session, input.drop);
  assertCanMoveStructureChild(session, moved, destinationParent, input.drop);

  const oldParentBefore = structuredClone(moved.parent);
  const newParentBefore =
    destinationParent.partId === moved.parent.partId ? undefined : structuredClone(destinationParent);
  const partBefore = moved.part === undefined ? undefined : structuredClone(moved.part);
  const drawableBefore = moved.drawable === undefined ? undefined : structuredClone(moved.drawable);

  removePartOrderedChild(session.graph, moved.parent, moved.child);

  const insertionIndex = resolveInsertionIndexAfterRemoval({
    session,
    destinationParent,
    movedChild: moved.child,
    drop: input.drop
  });
  insertPartOrderedChild(session.graph, destinationParent, moved.child, insertionIndex);

  if (moved.part !== undefined) {
    moved.part.parentPartId = destinationParent.partId;
  }

  if (moved.drawable !== undefined) {
    moved.drawable.partId = destinationParent.partId;
  }

  const sync = syncDrawOrderToPartOrder(session.graph);
  const oldParentAfter = structuredClone(moved.parent);
  const newParentAfter =
    destinationParent.partId === moved.parent.partId ? undefined : structuredClone(destinationParent);
  const partAfter = moved.part === undefined ? undefined : structuredClone(moved.part);
  const drawableAfter = moved.drawable === undefined ? undefined : structuredClone(moved.drawable);

  if (isNoOpStructureMove({
    oldParentBefore,
    oldParentAfter,
    newParentBefore,
    newParentAfter,
    partBefore,
    partAfter,
    drawableBefore,
    drawableAfter,
    drawOrderBefore: sync.drawOrderBefore,
    drawOrderAfter: sync.drawOrderAfter
  })) {
    throw new AuthoringMutationError("no_op_structure_order_move", "Structure move is already applied.");
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    moved: input.moved,
    ...(partBefore === undefined ? {} : { partBefore }),
    ...(partAfter === undefined ? {} : { partAfter }),
    ...(drawableBefore === undefined ? {} : { drawableBefore }),
    ...(drawableAfter === undefined ? {} : { drawableAfter }),
    oldParentBefore,
    oldParentAfter,
    ...(newParentBefore === undefined ? {} : { newParentBefore }),
    ...(newParentAfter === undefined ? {} : { newParentAfter }),
    drawOrderBefore: sync.drawOrderBefore,
    drawOrderAfter: sync.drawOrderAfter,
    authoringRevision: session.authoringRevision
  };
};

export const reorderChildrenBySourceOrder = (
  session: AuthoringSession,
  entries: readonly {
    readonly parentPartId: PartId;
    readonly child: PartChildEntry;
    readonly sourceOrder: number;
    readonly stableId: string;
  }[]
): void => {
  const entriesByParent = new Map<PartId, typeof entries>();
  for (const entry of entries) {
    entriesByParent.set(entry.parentPartId, [
      ...(entriesByParent.get(entry.parentPartId) ?? []),
      entry
    ]);
  }

  let changed = false;
  for (const [parentPartId, parentEntries] of entriesByParent) {
    const parent = getPartById(session.graph, parentPartId);
    if (parent === undefined) {
      continue;
    }

    const sortedChildren = [...parentEntries]
      .sort((left, right) => {
        const orderDelta = left.sourceOrder - right.sourceOrder;
        if (orderDelta !== 0) {
          return orderDelta;
        }

        return left.stableId.localeCompare(right.stableId);
      })
      .map((entry) => entry.child);
    const importedKeys = new Set(sortedChildren.map(createChildKey));
    const existing = getPartOrderedChildren(session.graph, parent);
    const next = [
      ...existing.filter((child) => !importedKeys.has(createChildKey(child))),
      ...sortedChildren
    ];

    if (!childrenEqualEntries(existing, next)) {
      insertSourceOrderedChildren(session.graph, parent, next);
      changed = true;
    }
  }

  const sync = syncDrawOrderToPartOrder(session.graph);
  if (sync.drawOrderBefore.length !== sync.drawOrderAfter.length) {
    changed = true;
  } else {
    changed =
      changed ||
      sync.drawOrderBefore.some((entry, index) => !drawOrderEntryEqual(entry, sync.drawOrderAfter[index]));
  }

  if (changed) {
    session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
    session.dirty = true;
  }
};

const resolveMoveItem = (
  session: AuthoringSession,
  moved: StructureOrderItem
): ResolvedMoveItem => {
  if (moved.kind === "part") {
    const part = getPartById(session.graph, moved.partId);
    if (part === undefined) {
      throw new AuthoringMutationError("missing_part", `Part does not exist: ${moved.partId}.`);
    }

    if (part.parentPartId === undefined) {
      throw new AuthoringMutationError("root_part_move", `Root part cannot be moved: ${moved.partId}.`);
    }

    const parent = getPartById(session.graph, part.parentPartId);
    if (parent === undefined) {
      throw new AuthoringMutationError(
        "missing_parent_part",
        `Parent part does not exist: ${part.parentPartId}.`
      );
    }

    return {
      moved,
      child: createPartChildEntry(moved.partId),
      parent,
      part
    };
  }

  const drawable = getDrawableById(session.graph, moved.drawableId);
  if (drawable === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Drawable does not exist: ${moved.drawableId}.`
    );
  }

  const parent = getPartById(session.graph, drawable.partId);
  if (parent === undefined) {
    throw new AuthoringMutationError(
      "missing_part",
      `Drawable parent part does not exist: ${drawable.partId}.`
    );
  }

  return {
    moved,
    child: createDrawableChildEntry(moved.drawableId),
    parent,
    drawable
  };
};

const resolveDestinationParent = (
  session: AuthoringSession,
  drop: StructureOrderDrop
): ModelPartDto => {
  if (drop.placement === "inside") {
    const parent = getPartById(session.graph, drop.parentPartId);
    if (parent === undefined) {
      throw new AuthoringMutationError(
        "missing_parent_part",
        `Destination part does not exist: ${drop.parentPartId}.`
      );
    }

    return parent;
  }

  const targetParentPartId = resolveTargetParentPartId(session, drop.target);
  if (targetParentPartId === undefined) {
    throw new AuthoringMutationError("root_part_drop", "Cannot drop before or after a root part.");
  }

  const parent = getPartById(session.graph, targetParentPartId);
  if (parent === undefined) {
    throw new AuthoringMutationError(
      "missing_parent_part",
      `Target parent part does not exist: ${targetParentPartId}.`
    );
  }

  return parent;
};

const resolveTargetParentPartId = (
  session: AuthoringSession,
  target: StructureOrderItem
): PartId | undefined => {
  if (target.kind === "part") {
    const targetPart = getPartById(session.graph, target.partId);
    if (targetPart === undefined) {
      throw new AuthoringMutationError("missing_part", `Target part does not exist: ${target.partId}.`);
    }

    return targetPart.parentPartId;
  }

  const targetDrawable = getDrawableById(session.graph, target.drawableId);
  if (targetDrawable === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Target drawable does not exist: ${target.drawableId}.`
    );
  }

  return targetDrawable.partId;
};

const assertCanMoveStructureChild = (
  session: AuthoringSession,
  moved: ResolvedMoveItem,
  destinationParent: ModelPartDto,
  drop: StructureOrderDrop
): void => {
  if (drop.placement !== "inside" && itemsEqual(moved.moved, drop.target)) {
    throw new AuthoringMutationError("no_op_structure_order_move", "Cannot drop a row onto itself.");
  }

  if (moved.part !== undefined) {
    if (
      destinationParent.partId === moved.part.partId ||
      isDescendantPart(session, moved.part.partId, destinationParent.partId)
    ) {
      throw new AuthoringMutationError(
        "part_cycle",
        `Part ${moved.part.partId} cannot be parented by descendant ${destinationParent.partId}.`
      );
    }
  }
};

const resolveInsertionIndexAfterRemoval = (input: {
  readonly session: AuthoringSession;
  readonly destinationParent: ModelPartDto;
  readonly movedChild: PartChildEntry;
  readonly drop: StructureOrderDrop;
}): number => {
  if (input.drop.placement === "inside") {
    return 0;
  }

  const targetChild = toChildEntry(input.drop.target);
  if (partChildEntriesEqual(targetChild, input.movedChild)) {
    return 0;
  }

  const targetIndex = findPartOrderedChildIndex(input.session.graph, input.destinationParent, targetChild);
  if (targetIndex < 0) {
    throw new AuthoringMutationError("missing_drop_target", "Drop target is not a child of its parent.");
  }

  return input.drop.placement === "before" ? targetIndex : targetIndex + 1;
};

const toChildEntry = (item: StructureOrderItem): PartChildEntry =>
  item.kind === "part" ? createPartChildEntry(item.partId) : createDrawableChildEntry(item.drawableId);

const itemsEqual = (left: StructureOrderItem, right: StructureOrderItem): boolean =>
  left.kind === right.kind &&
  (left.kind === "part"
    ? left.partId === (right as Extract<StructureOrderItem, { kind: "part" }>).partId
    : left.drawableId === (right as Extract<StructureOrderItem, { kind: "drawable" }>).drawableId);

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

const insertSourceOrderedChildren = (
  graph: AuthoringGraph,
  part: ModelPartDto,
  children: readonly PartChildEntry[]
): void => {
  const first = children[0];
  if (first === undefined) {
    return;
  }

  insertPartOrderedChild(graph, part, first, 0);
  for (let index = 1; index < children.length; index += 1) {
    const child = children[index];
    if (child !== undefined) {
      insertPartOrderedChild(graph, part, child, index);
    }
  }
};

const childrenEqual = (left: ModelPartDto, right: ModelPartDto): boolean =>
  childrenEqualEntries(left.children ?? [], right.children ?? []) &&
  arrayEqual(left.childPartIds, right.childPartIds) &&
  arrayEqual(left.drawableIds, right.drawableIds);

const isNoOpStructureMove = (input: {
  readonly oldParentBefore: ModelPartDto;
  readonly oldParentAfter: ModelPartDto;
  readonly newParentBefore: ModelPartDto | undefined;
  readonly newParentAfter: ModelPartDto | undefined;
  readonly partBefore: ModelPartDto | undefined;
  readonly partAfter: ModelPartDto | undefined;
  readonly drawableBefore: DrawableDto | undefined;
  readonly drawableAfter: DrawableDto | undefined;
  readonly drawOrderBefore: readonly DrawOrderEntryDto[];
  readonly drawOrderAfter: readonly DrawOrderEntryDto[];
}): boolean =>
  childrenEqual(input.oldParentBefore, input.oldParentAfter) &&
  optionalChildrenEqual(input.newParentBefore, input.newParentAfter) &&
  optionalPartMoveEqual(input.partBefore, input.partAfter) &&
  optionalDrawableMoveEqual(input.drawableBefore, input.drawableAfter) &&
  drawOrderEntriesEqual(input.drawOrderBefore, input.drawOrderAfter);

const optionalChildrenEqual = (
  before: ModelPartDto | undefined,
  after: ModelPartDto | undefined
): boolean =>
  before === undefined && after === undefined
    ? true
    : before !== undefined && after !== undefined && childrenEqual(before, after);

const optionalPartMoveEqual = (
  before: ModelPartDto | undefined,
  after: ModelPartDto | undefined
): boolean =>
  before === undefined && after === undefined
    ? true
    : before !== undefined && after !== undefined && before.parentPartId === after.parentPartId;

const optionalDrawableMoveEqual = (
  before: DrawableDto | undefined,
  after: DrawableDto | undefined
): boolean =>
  before === undefined && after === undefined
    ? true
    : before !== undefined &&
      after !== undefined &&
      before.partId === after.partId &&
      before.baseDrawOrder === after.baseDrawOrder;

const childrenEqualEntries = (
  left: readonly PartChildEntry[],
  right: readonly PartChildEntry[]
): boolean =>
  left.length === right.length &&
  left.every((leftChild, index) => {
    const rightChild = right[index];
    return rightChild !== undefined && partChildEntriesEqual(leftChild, rightChild);
  });

const arrayEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => right[index] === value);

const drawOrderEntryEqual = (
  left: AuthoringGraph["drawOrder"][number] | undefined,
  right: AuthoringGraph["drawOrder"][number] | undefined
): boolean =>
  left !== undefined &&
  right !== undefined &&
  left.drawableId === right.drawableId &&
  left.baseDrawOrder === right.baseDrawOrder &&
  left.stableOrder === right.stableOrder &&
  left.keyformSetId === right.keyformSetId;

const drawOrderEntriesEqual = (
  left: readonly DrawOrderEntryDto[],
  right: readonly DrawOrderEntryDto[]
): boolean =>
  left.length === right.length && left.every((entry, index) => drawOrderEntryEqual(entry, right[index]));

const createChildKey = (child: PartChildEntry): string =>
  child.kind === "part" ? `part:${child.partId}` : `drawable:${child.drawableId}`;
