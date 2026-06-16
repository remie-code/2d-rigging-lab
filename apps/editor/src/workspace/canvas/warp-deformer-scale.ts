import type { CanvasPoint } from "./canvas-projection";

export const WARP_DEFORMER_SCALE_HANDLE_IDS = [
  "leftEdge",
  "rightEdge",
  "topEdge",
  "bottomEdge",
  "topLeftCorner",
  "topRightCorner",
  "bottomLeftCorner",
  "bottomRightCorner"
] as const;

export type WarpDeformerScaleHandle = typeof WARP_DEFORMER_SCALE_HANDLE_IDS[number];

export type WarpDeformerScaleFailureReason =
  | "invalidHandle"
  | "invalidLatticeDimensions"
  | "cardinalityMismatch"
  | "nonFiniteInput"
  | "degenerateSourceSpan"
  | "nonFiniteOutput";

export type WarpDeformerScaleAxis = "x" | "y";

export type WarpDeformerScaleResult =
  | {
      readonly ok: true;
      readonly nextOffsets: readonly CanvasPoint[];
    }
  | {
      readonly ok: false;
      readonly reason: WarpDeformerScaleFailureReason;
      readonly axis?: WarpDeformerScaleAxis;
      readonly span?: number;
      readonly minimumSpan?: number;
      readonly expectedControlPointCount?: number;
      readonly actualRestControlPointCount?: number;
      readonly actualOffsetCount?: number;
    };

export interface ComputeWarpDeformerScaledControlPointOffsetsInput {
  readonly restControlPoints: readonly CanvasPoint[];
  readonly controlPointOffsets: readonly CanvasPoint[];
  readonly latticeColumns: number;
  readonly latticeRows: number;
  readonly handle: WarpDeformerScaleHandle;
  readonly dragDeltaCanvas: CanvasPoint;
  readonly minimumSourceSpan?: number;
}

interface PointBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

interface ScaleConfiguration {
  readonly movingX?: "left" | "right";
  readonly movingY?: "top" | "bottom";
}

interface AxisTransform {
  readonly fixedCoordinate: number;
  readonly scale: number;
}

const DEFAULT_MINIMUM_SOURCE_SPAN = 1e-6;

export function computeWarpDeformerScaledControlPointOffsets(
  input: ComputeWarpDeformerScaledControlPointOffsetsInput
): WarpDeformerScaleResult {
  const configuration = getScaleConfiguration(input.handle);
  if (configuration === null) {
    return { ok: false, reason: "invalidHandle" };
  }

  const minimumSourceSpan = input.minimumSourceSpan ?? DEFAULT_MINIMUM_SOURCE_SPAN;
  if (
    !Number.isFinite(minimumSourceSpan) ||
    minimumSourceSpan < 0 ||
    !isFiniteCanvasPoint(input.dragDeltaCanvas)
  ) {
    return { ok: false, reason: "nonFiniteInput" };
  }

  const expectedControlPointCount = getExpectedControlPointCount(input);
  if (expectedControlPointCount === null) {
    return { ok: false, reason: "invalidLatticeDimensions" };
  }

  if (
    input.restControlPoints.length !== expectedControlPointCount ||
    input.controlPointOffsets.length !== expectedControlPointCount
  ) {
    return {
      ok: false,
      reason: "cardinalityMismatch",
      expectedControlPointCount,
      actualRestControlPointCount: input.restControlPoints.length,
      actualOffsetCount: input.controlPointOffsets.length
    };
  }

  const currentPoints: CanvasPoint[] = [];
  for (let index = 0; index < expectedControlPointCount; index += 1) {
    const restPoint = input.restControlPoints[index];
    const offset = input.controlPointOffsets[index];
    if (
      restPoint === undefined ||
      offset === undefined ||
      !isFiniteCanvasPoint(restPoint) ||
      !isFiniteCanvasPoint(offset)
    ) {
      return { ok: false, reason: "nonFiniteInput" };
    }

    const currentPoint = {
      x: restPoint.x + offset.x,
      y: restPoint.y + offset.y
    };
    if (!isFiniteCanvasPoint(currentPoint)) {
      return { ok: false, reason: "nonFiniteInput" };
    }
    currentPoints.push(currentPoint);
  }

  const bounds = getPointBounds(currentPoints);
  const xTransform = createXTransform({
    bounds,
    dragDeltaCanvas: input.dragDeltaCanvas,
    minimumSourceSpan,
    movingX: configuration.movingX
  });
  if (xTransform.ok === false) {
    return xTransform;
  }

  const yTransform = createYTransform({
    bounds,
    dragDeltaCanvas: input.dragDeltaCanvas,
    minimumSourceSpan,
    movingY: configuration.movingY
  });
  if (yTransform.ok === false) {
    return yTransform;
  }

  const nextOffsets: CanvasPoint[] = [];
  for (let index = 0; index < currentPoints.length; index += 1) {
    const point = currentPoints[index];
    const restPoint = input.restControlPoints[index];
    if (point === undefined || restPoint === undefined) {
      return { ok: false, reason: "cardinalityMismatch" };
    }

    const scaledPoint = {
      x: applyAxisTransform(point.x, xTransform.transform),
      y: applyAxisTransform(point.y, yTransform.transform)
    };
    const nextOffset = {
      x: scaledPoint.x - restPoint.x,
      y: scaledPoint.y - restPoint.y
    };
    if (!isFiniteCanvasPoint(nextOffset)) {
      return { ok: false, reason: "nonFiniteOutput" };
    }
    nextOffsets.push(nextOffset);
  }

  return {
    ok: true,
    nextOffsets
  };
}

function getExpectedControlPointCount(input: {
  readonly latticeColumns: number;
  readonly latticeRows: number;
}): number | null {
  if (
    !Number.isInteger(input.latticeColumns) ||
    !Number.isInteger(input.latticeRows) ||
    input.latticeColumns < 2 ||
    input.latticeRows < 2
  ) {
    return null;
  }

  return input.latticeColumns * input.latticeRows;
}

function getScaleConfiguration(handle: WarpDeformerScaleHandle): ScaleConfiguration | null {
  switch (handle) {
    case "leftEdge":
      return { movingX: "left" };
    case "rightEdge":
      return { movingX: "right" };
    case "topEdge":
      return { movingY: "top" };
    case "bottomEdge":
      return { movingY: "bottom" };
    case "topLeftCorner":
      return { movingX: "left", movingY: "top" };
    case "topRightCorner":
      return { movingX: "right", movingY: "top" };
    case "bottomLeftCorner":
      return { movingX: "left", movingY: "bottom" };
    case "bottomRightCorner":
      return { movingX: "right", movingY: "bottom" };
    default:
      return null;
  }
}

function createXTransform(input: {
  readonly bounds: PointBounds;
  readonly dragDeltaCanvas: CanvasPoint;
  readonly minimumSourceSpan: number;
  readonly movingX: ScaleConfiguration["movingX"];
}):
  | { readonly ok: true; readonly transform?: AxisTransform }
  | Extract<WarpDeformerScaleResult, { readonly ok: false }> {
  if (input.movingX === undefined) {
    return { ok: true };
  }

  const span = input.bounds.maxX - input.bounds.minX;
  if (span <= input.minimumSourceSpan) {
    return {
      ok: false,
      reason: "degenerateSourceSpan",
      axis: "x",
      span,
      minimumSpan: input.minimumSourceSpan
    };
  }

  const fixedCoordinate = input.movingX === "left" ? input.bounds.maxX : input.bounds.minX;
  const movingCoordinate = input.movingX === "left" ? input.bounds.minX : input.bounds.maxX;
  const scale = (movingCoordinate + input.dragDeltaCanvas.x - fixedCoordinate) /
    (movingCoordinate - fixedCoordinate);

  if (!Number.isFinite(scale)) {
    return { ok: false, reason: "nonFiniteOutput" };
  }

  return {
    ok: true,
    transform: { fixedCoordinate, scale }
  };
}

function createYTransform(input: {
  readonly bounds: PointBounds;
  readonly dragDeltaCanvas: CanvasPoint;
  readonly minimumSourceSpan: number;
  readonly movingY: ScaleConfiguration["movingY"];
}):
  | { readonly ok: true; readonly transform?: AxisTransform }
  | Extract<WarpDeformerScaleResult, { readonly ok: false }> {
  if (input.movingY === undefined) {
    return { ok: true };
  }

  const span = input.bounds.maxY - input.bounds.minY;
  if (span <= input.minimumSourceSpan) {
    return {
      ok: false,
      reason: "degenerateSourceSpan",
      axis: "y",
      span,
      minimumSpan: input.minimumSourceSpan
    };
  }

  const fixedCoordinate = input.movingY === "top" ? input.bounds.maxY : input.bounds.minY;
  const movingCoordinate = input.movingY === "top" ? input.bounds.minY : input.bounds.maxY;
  const scale = (movingCoordinate + input.dragDeltaCanvas.y - fixedCoordinate) /
    (movingCoordinate - fixedCoordinate);

  if (!Number.isFinite(scale)) {
    return { ok: false, reason: "nonFiniteOutput" };
  }

  return {
    ok: true,
    transform: { fixedCoordinate, scale }
  };
}

function applyAxisTransform(coordinate: number, transform: AxisTransform | undefined): number {
  if (transform === undefined) {
    return coordinate;
  }

  return transform.fixedCoordinate + (coordinate - transform.fixedCoordinate) * transform.scale;
}

function getPointBounds(points: readonly CanvasPoint[]): PointBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, maxX, minY, maxY };
}

function isFiniteCanvasPoint(point: CanvasPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}
