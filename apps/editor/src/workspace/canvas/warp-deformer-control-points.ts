import type { RectDto, RigControlId } from "@private-2d-rigging-lab/contracts";

import {
  canvasToScreenPoint,
  type CanvasDeformerOverlayProjection,
  type CanvasPoint,
  type CanvasViewState
} from "./canvas-projection";

export const WARP_CONTROL_POINT_HIT_TOLERANCE_PX = 10;

export interface WarpControlPointPosition {
  readonly index: number;
  readonly column: number;
  readonly row: number;
  readonly canvasPoint: CanvasPoint;
  readonly screenPoint: CanvasPoint;
}

export interface WarpControlPointHit extends WarpControlPointPosition {
  readonly distancePx: number;
}

export interface WarpControlPointSelectionState {
  readonly rigControlId: RigControlId;
  readonly pointCount: number;
  readonly indices: readonly number[];
}

export function getWarpControlPointCount(
  overlay: CanvasDeformerOverlayProjection | undefined
): number {
  if (overlay?.kind !== "warp") {
    return 0;
  }

  return normalizeGridSize(overlay.transformColumns) * normalizeGridSize(overlay.transformRows);
}

export function listWarpControlPointPositions(input: {
  readonly overlay: CanvasDeformerOverlayProjection;
  readonly view: CanvasViewState;
}): readonly WarpControlPointPosition[] {
  if (input.overlay.kind !== "warp") {
    return [];
  }

  const columns = normalizeGridSize(input.overlay.transformColumns);
  const rows = normalizeGridSize(input.overlay.transformRows);
  const result: WarpControlPointPosition[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const canvasPoint = getWarpControlPointCanvasPosition(input.overlay, column, row);
      result.push({
        index: row * columns + column,
        column,
        row,
        canvasPoint,
        screenPoint: canvasToScreenPoint(canvasPoint, input.view)
      });
    }
  }

  return result;
}

export function getWarpControlPointCanvasPosition(
  overlay: CanvasDeformerOverlayProjection,
  column: number,
  row: number
): CanvasPoint {
  const columns = normalizeGridSize(overlay.transformColumns);
  const rows = normalizeGridSize(overlay.transformRows);
  const index = row * columns + column;
  const evaluated = overlay.evaluatedControlPoints?.[index];
  if (evaluated !== undefined) {
    return {
      x: finiteOrZero(evaluated.x),
      y: finiteOrZero(evaluated.y)
    };
  }

  const base = {
    x: overlay.domainBounds.x + overlay.domainBounds.width * toUnitGridPosition(column, columns),
    y: overlay.domainBounds.y + overlay.domainBounds.height * toUnitGridPosition(row, rows)
  };
  const offset = overlay.controlPointOffsets?.[index];
  if (offset === undefined) {
    return base;
  }

  return {
    x: base.x + finiteOrZero(offset.x),
    y: base.y + finiteOrZero(offset.y)
  };
}

export function hitTestWarpControlPoint(input: {
  readonly overlay: CanvasDeformerOverlayProjection | undefined;
  readonly view: CanvasViewState;
  readonly screenPoint: CanvasPoint;
  readonly tolerancePx?: number;
}): WarpControlPointHit | undefined {
  if (input.overlay?.kind !== "warp") {
    return undefined;
  }

  const tolerance = Math.max(0, input.tolerancePx ?? WARP_CONTROL_POINT_HIT_TOLERANCE_PX);
  const toleranceSquared = tolerance * tolerance;
  let best: WarpControlPointHit | undefined;

  for (const position of listWarpControlPointPositions({
    overlay: input.overlay,
    view: input.view
  })) {
    const distanceSquared =
      (position.screenPoint.x - input.screenPoint.x) ** 2 +
      (position.screenPoint.y - input.screenPoint.y) ** 2;
    if (distanceSquared > toleranceSquared) {
      continue;
    }

    const distancePx = Math.sqrt(distanceSquared);
    if (best === undefined || distancePx < best.distancePx) {
      best = {
        ...position,
        distancePx
      };
    }
  }

  return best;
}

export function selectWarpControlPointsInMarquee(input: {
  readonly overlay: CanvasDeformerOverlayProjection | undefined;
  readonly view: CanvasViewState;
  readonly rect: RectDto;
}): readonly number[] {
  if (input.overlay?.kind !== "warp") {
    return [];
  }

  const rect = normalizeRect(input.rect);
  return listWarpControlPointPositions({
    overlay: input.overlay,
    view: input.view
  })
    .filter((position) => pointInRect(position.screenPoint, rect))
    .map((position) => position.index);
}

export function createWarpControlPointSelection(input: {
  readonly rigControlId: RigControlId;
  readonly pointCount: number;
  readonly indices: readonly number[];
}): WarpControlPointSelectionState | null {
  const pointCount = Math.max(0, Math.floor(input.pointCount));
  const indices = normalizeIndices(input.indices, pointCount);
  if (indices.length === 0) {
    return null;
  }

  return {
    rigControlId: input.rigControlId,
    pointCount,
    indices
  };
}

export function isWarpControlPointSelectionScoped(
  selection: WarpControlPointSelectionState | null,
  rigControlId: RigControlId | undefined,
  pointCount: number
): selection is WarpControlPointSelectionState {
  return (
    selection !== null &&
    rigControlId !== undefined &&
    selection.rigControlId === rigControlId &&
    selection.pointCount === pointCount
  );
}

export function resolveWarpPointDragSelection(input: {
  readonly currentSelection: WarpControlPointSelectionState | null;
  readonly rigControlId: RigControlId;
  readonly pointCount: number;
  readonly hitIndex: number;
}): readonly number[] {
  if (
    isWarpControlPointSelectionScoped(
      input.currentSelection,
      input.rigControlId,
      input.pointCount
    ) &&
    input.currentSelection.indices.includes(input.hitIndex)
  ) {
    return input.currentSelection.indices;
  }

  return normalizeIndices([input.hitIndex], input.pointCount);
}

export function normalizeWarpControlPointOffsets(
  offsets: readonly CanvasPoint[] | undefined,
  pointCount: number
): readonly CanvasPoint[] {
  const count = Math.max(0, Math.floor(pointCount));
  return Array.from({ length: count }, (_, index) => {
    const offset = offsets?.[index];
    return {
      x: finiteOrZero(offset?.x),
      y: finiteOrZero(offset?.y)
    };
  });
}

export function applyWarpControlPointDragDelta(input: {
  readonly baseOffsets: readonly CanvasPoint[];
  readonly pointCount: number;
  readonly selectedIndices: readonly number[];
  readonly deltaCanvas: CanvasPoint;
}): readonly CanvasPoint[] {
  const pointCount = Math.max(0, Math.floor(input.pointCount));
  const selectedIndices = new Set(normalizeIndices(input.selectedIndices, pointCount));
  const baseOffsets = normalizeWarpControlPointOffsets(input.baseOffsets, pointCount);
  const delta = {
    x: finiteOrZero(input.deltaCanvas.x),
    y: finiteOrZero(input.deltaCanvas.y)
  };

  return baseOffsets.map((offset, index) =>
    selectedIndices.has(index)
      ? {
          x: offset.x + delta.x,
          y: offset.y + delta.y
        }
      : offset
  );
}

export function areWarpControlPointOffsetsEqual(
  left: readonly CanvasPoint[],
  right: readonly CanvasPoint[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (leftOffset, index) =>
      Math.abs(leftOffset.x - (right[index]?.x ?? 0)) < 1e-6 &&
      Math.abs(leftOffset.y - (right[index]?.y ?? 0)) < 1e-6
  );
}

export function normalizeScreenRect(
  start: CanvasPoint,
  end: CanvasPoint
): RectDto {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);

  return {
    x: left,
    y: top,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

function normalizeIndices(indices: readonly number[], pointCount: number): readonly number[] {
  return [...new Set(indices.map((index) => Math.floor(index)))]
    .filter((index) => index >= 0 && index < pointCount)
    .sort((left, right) => left - right);
}

function normalizeRect(rect: RectDto): RectDto {
  return {
    x: rect.width >= 0 ? rect.x : rect.x + rect.width,
    y: rect.height >= 0 ? rect.y : rect.y + rect.height,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height)
  };
}

function pointInRect(point: CanvasPoint, rect: RectDto): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function toUnitGridPosition(index: number, size: number): number {
  return size <= 1 ? 0 : index / (size - 1);
}

function normalizeGridSize(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function finiteOrZero(value: number | undefined): number {
  return value === undefined || !Number.isFinite(value) ? 0 : value;
}
