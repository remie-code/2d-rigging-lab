import { getPartOrderedChildren, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { PartId } from "@private-2d-rigging-lab/contracts";

export interface InitialPartCollapseOptions {
  readonly expandPartIds?: readonly PartId[];
}

export const createInitialCollapsedPartIds = (
  session: AuthoringSession,
  options: InitialPartCollapseOptions = {}
): ReadonlySet<PartId> => {
  const collapsedPartIds = new Set<PartId>();

  for (const part of session.graph.parts) {
    if (part.parentPartId === undefined) {
      continue;
    }

    if (getPartOrderedChildren(session.graph, part).length > 0) {
      collapsedPartIds.add(part.partId);
    }
  }

  return expandPartPaths(session, collapsedPartIds, options.expandPartIds ?? []);
};

export const mergeNewPartInitialCollapsedPartIds = (
  current: ReadonlySet<PartId>,
  previousSession: AuthoringSession,
  nextSession: AuthoringSession,
  options: InitialPartCollapseOptions = {}
): ReadonlySet<PartId> => {
  const previousPartIds = new Set(previousSession.graph.parts.map((part) => part.partId));
  const next = new Set(current);
  const nextInitialCollapsedPartIds = createInitialCollapsedPartIds(nextSession, options);

  for (const partId of nextInitialCollapsedPartIds) {
    if (!previousPartIds.has(partId)) {
      next.add(partId);
    }
  }

  return expandPartPaths(nextSession, next, options.expandPartIds ?? []);
};

const expandPartPaths = (
  session: AuthoringSession,
  collapsedPartIds: ReadonlySet<PartId>,
  partIds: readonly PartId[]
): ReadonlySet<PartId> => {
  if (partIds.length === 0 || collapsedPartIds.size === 0) {
    return collapsedPartIds;
  }

  const next = new Set(collapsedPartIds);
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  let changed = false;

  for (const partId of partIds) {
    let current = partsById.get(partId);

    while (current !== undefined) {
      changed = next.delete(current.partId) || changed;
      current = current.parentPartId === undefined
        ? undefined
        : partsById.get(current.parentPartId);
    }
  }

  return changed ? next : collapsedPartIds;
};
