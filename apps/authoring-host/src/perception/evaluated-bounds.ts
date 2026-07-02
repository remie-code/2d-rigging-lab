import type { RectDto } from "@private-2d-rigging-lab/contracts";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

/**
 * Evaluated bounding-box helpers (Wave104 Domain A).
 *
 * These derive stage-space bounding boxes from an evaluated
 * {@link RuntimeSnapshotDto}. Domain C (measurement) reuses this exact public
 * form, so the shapes here are the shared contract for perception geometry
 * queries.
 *
 * Drawable bounds are already evaluated on `snapshot.drawables[].bounds`.
 * rigControl bounds are available on `snapshot.rigControls[].bounds` when the
 * rig control evaluated to a finite region. The absolute per-control-point
 * lattice coordinates for warp rig controls are NOT part of the public snapshot
 * shape; only the evaluated `bounds` are exposed here.
 */

export interface EvaluatedDrawableBounds {
  readonly drawableId: string;
  readonly bounds: RectDto;
}

export interface EvaluatedRigControlBounds {
  readonly rigControlId: string;
  readonly kind: "rotation2d" | "warpLattice2d";
  readonly bounds: RectDto;
}

/** Bounds for a single drawable, or undefined if it is not in the snapshot. */
export const evaluatedDrawableBounds = (
  snapshot: RuntimeSnapshotDto,
  drawableId: string
): EvaluatedDrawableBounds | undefined => {
  const drawable = snapshot.drawables.find((entry) => entry.drawableId === drawableId);
  if (drawable === undefined) {
    return undefined;
  }

  return { drawableId, bounds: drawable.bounds };
};

/** Bounds for every drawable in draw-list order (stable). */
export const allEvaluatedDrawableBounds = (
  snapshot: RuntimeSnapshotDto
): readonly EvaluatedDrawableBounds[] =>
  snapshot.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    bounds: drawable.bounds
  }));

/** Evaluated bounds for a rig control, or undefined if none is available. */
export const evaluatedRigControlBounds = (
  snapshot: RuntimeSnapshotDto,
  rigControlId: string
): EvaluatedRigControlBounds | undefined => {
  const rigControl = snapshot.rigControls.find(
    (entry) => entry.rigControlId === rigControlId
  );
  if (rigControl === undefined || rigControl.bounds === undefined) {
    return undefined;
  }

  return {
    rigControlId,
    kind: rigControl.kind,
    bounds: rigControl.bounds
  };
};

/**
 * Union of the given rectangles. Returns undefined when the input is empty or
 * every rectangle is degenerate (non-positive extent). Deterministic: pure min
 * / max over the inputs.
 */
export const unionBounds = (
  rects: readonly RectDto[]
): RectDto | undefined => {
  const usable = rects.filter(
    (rect) =>
      Number.isFinite(rect.x) &&
      Number.isFinite(rect.y) &&
      Number.isFinite(rect.width) &&
      Number.isFinite(rect.height) &&
      rect.width > 0 &&
      rect.height > 0
  );
  if (usable.length === 0) {
    return undefined;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const rect of usable) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

/**
 * The model-wide bounds: the union of every drawable's evaluated bounds. This
 * is the default framing region for `renderView` when no explicit view is
 * given.
 */
export const modelEvaluatedBounds = (
  snapshot: RuntimeSnapshotDto
): RectDto | undefined =>
  unionBounds(snapshot.drawables.map((drawable) => drawable.bounds));
