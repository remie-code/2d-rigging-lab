import type { ModelPartDto } from "@private-2d-rigging-lab/package-format";

import type { DrawableListItemState } from "./drawable-list-state.js";

export const warpLattice2dDraftColumns = 2;
export const warpLattice2dDraftRows = 2;
export const warpLattice2dDraftControlPointCount =
  warpLattice2dDraftColumns * warpLattice2dDraftRows;

export interface WarpLattice2dDraftPointState {
  readonly x: number;
  readonly y: number;
}

export interface WarpLattice2dDraftBoundsState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WarpLattice2dDraftState {
  readonly draftRigControlId: string;
  readonly displayName: string;
  readonly partId: string;
  readonly bindSpace: "rigControlLocalRest";
  readonly domainBounds: WarpLattice2dDraftBoundsState;
  readonly latticeColumns: typeof warpLattice2dDraftColumns;
  readonly latticeRows: typeof warpLattice2dDraftRows;
  readonly restControlPoints: readonly WarpLattice2dDraftPointState[];
  readonly interpolationMethod: "bilinear-grid-v1";
  readonly targetProperty: "controlPointOffsets";
  readonly compositionMode: "replace";
  readonly keyValue: number;
  readonly controlPointOffsets: readonly WarpLattice2dDraftPointState[];
}

export const createEmptyWarpLattice2dDraftState = (
  input: Partial<Pick<WarpLattice2dDraftState, "partId" | "domainBounds">> = {}
): WarpLattice2dDraftState => {
  const domainBounds = input.domainBounds ?? createFallbackWarpLattice2dBounds();

  return {
    draftRigControlId: "rig_warp_lattice_draft",
    displayName: "2x2 Warp Lattice Draft",
    partId: input.partId ?? "",
    bindSpace: "rigControlLocalRest",
    domainBounds,
    latticeColumns: warpLattice2dDraftColumns,
    latticeRows: warpLattice2dDraftRows,
    restControlPoints: projectMinimumWarpLattice2dRestControlPoints(domainBounds),
    interpolationMethod: "bilinear-grid-v1",
    targetProperty: "controlPointOffsets",
    compositionMode: "replace",
    keyValue: 1,
    controlPointOffsets: createZeroWarpLattice2dControlPointOffsets()
  };
};

export const projectWarpLattice2dDraftState = (input: {
  readonly parts: readonly ModelPartDto[];
  readonly drawables: readonly DrawableListItemState[];
}): WarpLattice2dDraftState =>
  createEmptyWarpLattice2dDraftState({
    partId: input.parts[0]?.partId ?? "",
    domainBounds: projectDefaultWarpLattice2dDraftBounds(input.drawables)
  });

export const projectMinimumWarpLattice2dRestControlPoints = (
  bounds: WarpLattice2dDraftBoundsState
): readonly WarpLattice2dDraftPointState[] => [
  { x: bounds.x, y: bounds.y },
  { x: bounds.x + bounds.width, y: bounds.y },
  { x: bounds.x, y: bounds.y + bounds.height },
  { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
];

export const createZeroWarpLattice2dControlPointOffsets = ():
  readonly WarpLattice2dDraftPointState[] =>
  Array.from({ length: warpLattice2dDraftControlPointCount }, () => ({ x: 0, y: 0 }));

const projectDefaultWarpLattice2dDraftBounds = (
  drawables: readonly DrawableListItemState[]
): WarpLattice2dDraftBoundsState => {
  const drawable = drawables.find((candidate) => candidate.visible) ?? drawables[0];
  if (drawable === undefined || drawable.bounds.width <= 0 || drawable.bounds.height <= 0) {
    return createFallbackWarpLattice2dBounds();
  }

  return { ...drawable.bounds };
};

const createFallbackWarpLattice2dBounds = (): WarpLattice2dDraftBoundsState => ({
  x: 0,
  y: 0,
  width: 100,
  height: 100
});
