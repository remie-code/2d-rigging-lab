import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DiagnosticDto, DrawableId, RectDto, RigControlId } from "@private-2d-rigging-lab/contracts";

import { commitUpdateRigControl, type EditorSessionCommandResult } from "./editor-session-commands";
import {
  hasRigControlKeyforms,
  resolveWarpDeformerChildrenBounds
} from "./rig-tool-state";

type RigControlDto = AuthoringSession["graph"]["rigControls"][number];
type WarpRigControlDto = Extract<RigControlDto, { readonly kind: "warpLattice2d" }>;

export function commitMeshApplyAutoRefit(
  session: AuthoringSession,
  committedDrawableIds: readonly DrawableId[]
): EditorSessionCommandResult {
  const candidates = collectAffectedWarpAncestors(session, committedDrawableIds);
  let nextSession = session;
  let committed = false;
  const diagnostics: DiagnosticDto[] = [];

  for (const candidate of candidates) {
    const rigControl = findWarpRigControl(nextSession, candidate.rigControlId);
    if (rigControl === undefined || hasRigControlKeyforms(nextSession, rigControl.rigControlId)) {
      continue;
    }

    const requiredBounds = resolveWarpDeformerChildrenBounds(
      nextSession,
      rigControl.childDrawableIds,
      rigControl.childRigControlIds
    );
    if (requiredBounds === undefined) {
      continue;
    }

    const nextBounds = unionRects([rigControl.domainBounds, requiredBounds]);
    if (nextBounds === undefined || sameRect(nextBounds, rigControl.domainBounds)) {
      continue;
    }

    const result = commitUpdateRigControl(nextSession, {
      rigControlId: rigControl.rigControlId,
      domainBounds: nextBounds
    });
    diagnostics.push(...result.diagnostics);
    if (result.committed) {
      nextSession = result.session;
      committed = true;
    }
  }

  return {
    committed,
    session: nextSession,
    diagnostics
  };
}

function collectAffectedWarpAncestors(
  session: AuthoringSession,
  committedDrawableIds: readonly DrawableId[]
): readonly { readonly rigControlId: RigControlId; readonly hierarchyDepth: number }[] {
  const rigControlsById = new Map(
    session.graph.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );
  const bestDepthByRigControlId = new Map<RigControlId, number>();

  for (const drawableId of new Set(committedDrawableIds)) {
    const directParents = session.graph.rigControls.filter((rigControl) =>
      rigControl.childDrawableIds.includes(drawableId)
    );

    for (const directParent of directParents) {
      let current: RigControlDto | undefined = directParent;
      const visited = new Set<RigControlId>();
      while (current !== undefined && !visited.has(current.rigControlId)) {
        visited.add(current.rigControlId);
        if (current.kind === "warpLattice2d") {
          bestDepthByRigControlId.set(
            current.rigControlId,
            Math.max(
              bestDepthByRigControlId.get(current.rigControlId) ?? 0,
              getRigControlHierarchyDepth(rigControlsById, current.rigControlId)
            )
          );
        }

        current =
          current.parentId === undefined ? undefined : rigControlsById.get(current.parentId);
      }
    }
  }

  return [...bestDepthByRigControlId.entries()]
    .map(([rigControlId, hierarchyDepth]) => ({ rigControlId, hierarchyDepth }))
    .sort((left, right) => right.hierarchyDepth - left.hierarchyDepth);
}

function getRigControlHierarchyDepth(
  rigControlsById: ReadonlyMap<RigControlId, RigControlDto>,
  rigControlId: RigControlId
): number {
  let depth = 0;
  let current = rigControlsById.get(rigControlId);
  const visited = new Set<RigControlId>();
  while (current?.parentId !== undefined && !visited.has(current.rigControlId)) {
    visited.add(current.rigControlId);
    const parent = rigControlsById.get(current.parentId);
    if (parent === undefined) {
      break;
    }

    depth += 1;
    current = parent;
  }

  return depth;
}

function findWarpRigControl(
  session: AuthoringSession,
  rigControlId: RigControlId
): WarpRigControlDto | undefined {
  const rigControl = session.graph.rigControls.find(
    (candidate) => candidate.rigControlId === rigControlId
  );

  return rigControl?.kind === "warpLattice2d" ? rigControl : undefined;
}

function unionRects(rects: readonly RectDto[]): RectDto | undefined {
  const positive = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  if (positive.length === 0) {
    return undefined;
  }

  const left = Math.min(...positive.map((rect) => rect.x));
  const top = Math.min(...positive.map((rect) => rect.y));
  const right = Math.max(...positive.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...positive.map((rect) => rect.y + rect.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function sameRect(left: RectDto, right: RectDto): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}
