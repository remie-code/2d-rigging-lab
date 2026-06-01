import type {
  DiagnosticDto,
  DrawableId,
  RigControlId
} from "@private-2d-rigging-lab/contracts";

import { createRuntimeDiagnostic } from "./diagnostics.js";
import type {
  NormalizedRigControlNode,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";

export interface RigControlHierarchyEvaluation {
  readonly orderedRigControlIds: readonly RigControlId[];
  readonly descendantRigControlIdsById: ReadonlyMap<RigControlId, readonly RigControlId[]>;
  readonly declaredChildDrawableIdsById: ReadonlyMap<RigControlId, readonly DrawableId[]>;
  readonly blockedRigControlIds: ReadonlyMap<RigControlId, readonly RigControlHierarchyBlockReason[]>;
  readonly diagnostics: readonly DiagnosticDto[];
}

export type RigControlHierarchyBlockReason =
  | "blockedAncestor"
  | "cycle"
  | "missingChild"
  | "missingParent";

export const createRigControlHierarchyEvaluation = (
  graph: NormalizedRuntimeGraph
): RigControlHierarchyEvaluation => {
  const diagnostics: DiagnosticDto[] = [];
  const hierarchyOrder = createParentBeforeChildOrder(graph, diagnostics);

  return {
    orderedRigControlIds: hierarchyOrder.orderedRigControlIds,
    descendantRigControlIdsById: createDescendantRigControlIdsById(graph),
    declaredChildDrawableIdsById: createDeclaredChildDrawableIdsById(graph),
    blockedRigControlIds: hierarchyOrder.blockedRigControlIds,
    diagnostics
  };
};

export const createAffectedDrawableIds = (
  rigControl: NormalizedRigControlNode,
  descendantRigControlIdsById: ReadonlyMap<RigControlId, readonly RigControlId[]>,
  declaredChildDrawableIdsById: ReadonlyMap<RigControlId, readonly DrawableId[]>
): readonly DrawableId[] => {
  const affected = [
    ...sortDrawableIds(rigControl.childDrawableIds),
    ...(descendantRigControlIdsById.get(rigControl.rigControlId) ?? []).flatMap(
      (childRigControlId) => declaredChildDrawableIdsById.get(childRigControlId) ?? []
    )
  ];

  return sortDrawableIds(unique(affected));
};

export const sortRigControlIds = (rigControlIds: Iterable<RigControlId>): RigControlId[] =>
  [...rigControlIds].sort((left, right) => left.localeCompare(right));

export const sortDrawableIds = (drawableIds: Iterable<DrawableId>): DrawableId[] =>
  [...drawableIds].sort((left, right) => left.localeCompare(right));

const createParentBeforeChildOrder = (
  graph: NormalizedRuntimeGraph,
  diagnostics: DiagnosticDto[]
): {
  readonly orderedRigControlIds: readonly RigControlId[];
  readonly blockedRigControlIds: ReadonlyMap<RigControlId, readonly RigControlHierarchyBlockReason[]>;
} => {
  const ordered: RigControlId[] = [];
  const visited = new Set<RigControlId>();
  const visiting: RigControlId[] = [];
  const blockedRigControlIds = new Map<RigControlId, Set<RigControlHierarchyBlockReason>>();
  const allIds = sortRigControlIds([...graph.rigControls.keys()]);
  const rootIds = allIds.filter((rigControlId) => graph.rigControls.get(rigControlId)?.parentId === undefined);
  const startIds = [...rootIds, ...allIds.filter((rigControlId) => !rootIds.includes(rigControlId))];

  for (const rigControlId of startIds) {
    visitRigControl(graph, rigControlId, visiting, visited, ordered, diagnostics, blockedRigControlIds);
  }

  propagateBlockedAncestorState(graph, blockedRigControlIds);

  return {
    orderedRigControlIds: ordered,
    blockedRigControlIds: freezeBlockedRigControlIds(blockedRigControlIds)
  };
};

const visitRigControl = (
  graph: NormalizedRuntimeGraph,
  rigControlId: RigControlId,
  visiting: RigControlId[],
  visited: Set<RigControlId>,
  ordered: RigControlId[],
  diagnostics: DiagnosticDto[],
  blockedRigControlIds: Map<RigControlId, Set<RigControlHierarchyBlockReason>>
): void => {
  if (visited.has(rigControlId)) {
    return;
  }

  const rigControl = graph.rigControls.get(rigControlId);
  if (rigControl === undefined) {
    diagnostics.push(createMissingRigControlDiagnostic(rigControlId));
    return;
  }

  const cycleStartIndex = visiting.indexOf(rigControlId);
  if (cycleStartIndex !== -1) {
    diagnostics.push(createCycleDiagnostic(rigControlId));
    for (const cycleRigControlId of visiting.slice(cycleStartIndex)) {
      blockRigControlSubtree(graph, cycleRigControlId, "cycle", blockedRigControlIds);
    }
    return;
  }

  visiting.push(rigControlId);
  if (rigControl.parentId !== undefined) {
    if (graph.rigControls.has(rigControl.parentId)) {
      visitRigControl(
        graph,
        rigControl.parentId,
        visiting,
        visited,
        ordered,
        diagnostics,
        blockedRigControlIds
      );
    } else {
      diagnostics.push(createMissingParentRigControlDiagnostic(rigControl.parentId, rigControl.rigControlId));
      blockRigControlSubtree(graph, rigControl.rigControlId, "missingParent", blockedRigControlIds);
    }
  }

  for (const childRigControlId of sortRigControlIds(rigControl.childRigControlIds)) {
    if (!graph.rigControls.has(childRigControlId)) {
      diagnostics.push(createMissingRigControlDiagnostic(childRigControlId, rigControl.rigControlId));
      blockRigControlSubtree(graph, rigControl.rigControlId, "missingChild", blockedRigControlIds);
    }
  }

  visiting.pop();
  visited.add(rigControlId);
  ordered.push(rigControlId);
};

const createDescendantRigControlIdsById = (
  graph: NormalizedRuntimeGraph
): ReadonlyMap<RigControlId, readonly RigControlId[]> => {
  const result = new Map<RigControlId, readonly RigControlId[]>();

  for (const rigControlId of graph.rigControls.keys()) {
    result.set(rigControlId, collectDescendantRigControlIds(graph, rigControlId));
  }

  return result;
};

const collectDescendantRigControlIds = (
  graph: NormalizedRuntimeGraph,
  rigControlId: RigControlId,
  visited: ReadonlySet<RigControlId> = new Set()
): readonly RigControlId[] => {
  if (visited.has(rigControlId)) {
    return [];
  }

  const nextVisited = new Set([...visited, rigControlId]);
  const rigControl = graph.rigControls.get(rigControlId);
  if (rigControl === undefined) {
    return [];
  }

  return sortRigControlIds(rigControl.childRigControlIds).flatMap((childRigControlId) => [
    childRigControlId,
    ...collectDescendantRigControlIds(graph, childRigControlId, nextVisited)
  ]);
};

const createDeclaredChildDrawableIdsById = (
  graph: NormalizedRuntimeGraph
): ReadonlyMap<RigControlId, readonly DrawableId[]> =>
  new Map(
    [...graph.rigControls.values()].map((rigControl) => [
      rigControl.rigControlId,
      sortDrawableIds(rigControl.childDrawableIds)
    ])
  );

const createMissingRigControlDiagnostic = (
  rigControlId: RigControlId,
  parentRigControlId?: RigControlId
): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: "rigControl.childMissing",
    severity: "blocking",
    phase: "rigControl_evaluation",
    target:
      parentRigControlId === undefined
        ? { kind: "rigControl", id: rigControlId }
        : { kind: "rigControl", id: parentRigControlId },
    message: `Rig control hierarchy references missing child ${rigControlId}.`,
    evidence: [`rigControlId=${rigControlId}`]
  });

const createMissingParentRigControlDiagnostic = (
  parentRigControlId: RigControlId,
  rigControlId: RigControlId
): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: "rigControl.parentMissing",
    severity: "blocking",
    phase: "rigControl_evaluation",
    target: { kind: "rigControl", id: rigControlId },
    message: `Rig control ${rigControlId} references missing parent ${parentRigControlId}.`,
    evidence: [`parentRigControlId=${parentRigControlId}`, `rigControlId=${rigControlId}`]
  });

const createCycleDiagnostic = (rigControlId: RigControlId): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: "rigControl.cycle",
    severity: "blocking",
    phase: "rigControl_evaluation",
    target: { kind: "rigControl", id: rigControlId },
    message: `Rig control hierarchy contains a cycle at ${rigControlId}.`,
    evidence: [`rigControlId=${rigControlId}`]
  });

const blockRigControlSubtree = (
  graph: NormalizedRuntimeGraph,
  rootRigControlId: RigControlId,
  reason: RigControlHierarchyBlockReason,
  blockedRigControlIds: Map<RigControlId, Set<RigControlHierarchyBlockReason>>,
  visited: ReadonlySet<RigControlId> = new Set()
): void => {
  if (visited.has(rootRigControlId)) {
    return;
  }

  const rigControl = graph.rigControls.get(rootRigControlId);
  if (rigControl === undefined) {
    return;
  }

  const reasons = blockedRigControlIds.get(rootRigControlId) ?? new Set<RigControlHierarchyBlockReason>();
  reasons.add(reason);
  blockedRigControlIds.set(rootRigControlId, reasons);

  const nextVisited = new Set([...visited, rootRigControlId]);
  for (const childRigControlId of sortRigControlIds(rigControl.childRigControlIds)) {
    blockRigControlSubtree(graph, childRigControlId, reason, blockedRigControlIds, nextVisited);
  }
};

const propagateBlockedAncestorState = (
  graph: NormalizedRuntimeGraph,
  blockedRigControlIds: Map<RigControlId, Set<RigControlHierarchyBlockReason>>
): void => {
  let changed = true;
  while (changed) {
    changed = false;

    for (const rigControl of graph.rigControls.values()) {
      if (rigControl.parentId === undefined || !blockedRigControlIds.has(rigControl.parentId)) {
        continue;
      }

      const reasons = blockedRigControlIds.get(rigControl.rigControlId) ?? new Set<RigControlHierarchyBlockReason>();
      if (reasons.has("blockedAncestor")) {
        continue;
      }

      reasons.add("blockedAncestor");
      blockedRigControlIds.set(rigControl.rigControlId, reasons);
      changed = true;
    }
  }
};

const freezeBlockedRigControlIds = (
  blockedRigControlIds: ReadonlyMap<RigControlId, ReadonlySet<RigControlHierarchyBlockReason>>
): ReadonlyMap<RigControlId, readonly RigControlHierarchyBlockReason[]> =>
  new Map(
    [...blockedRigControlIds.entries()].map(([rigControlId, reasons]) => [
      rigControlId,
      [...reasons].sort((left, right) => left.localeCompare(right))
    ])
  );

const unique = <T>(values: readonly T[]): readonly T[] => [...new Set(values)];
