import type {
  CanvasDeformerOverlayProjection,
  CanvasPoint,
  CanvasViewState
} from "./canvas-projection";
import { canvasToScreenPoint, screenToCanvasPoint } from "./canvas-projection";

export type RotationDeformerHandleKind = "pivot" | "angle";

export interface RotationDeformerHandlePosition {
  readonly kind: RotationDeformerHandleKind;
  readonly canvasPoint: CanvasPoint;
  readonly screenPoint: CanvasPoint;
}

const PIVOT_HIT_TOLERANCE_PX = 8;
const ANGLE_HIT_TOLERANCE_PX = 9;
const MIN_ANGLE_HANDLE_RADIUS_PX = 12;

export function getRotationDeformerPivot(
  overlay: CanvasDeformerOverlayProjection
): CanvasPoint {
  return overlay.pivot ?? {
    x: overlay.domainBounds.x + overlay.domainBounds.width / 2,
    y: overlay.domainBounds.y + overlay.domainBounds.height / 2
  };
}

export function getRotationDeformerAngleHandleRadius(
  overlay: CanvasDeformerOverlayProjection,
  zoom: number
): number {
  return Math.max(
    MIN_ANGLE_HANDLE_RADIUS_PX / Math.max(zoom, 0.000001),
    Math.min(overlay.domainBounds.width, overlay.domainBounds.height) * 0.28
  );
}

export function listRotationDeformerHandlePositions(input: {
  readonly overlay: CanvasDeformerOverlayProjection;
  readonly view: CanvasViewState;
}): readonly RotationDeformerHandlePosition[] {
  const pivot = getRotationDeformerPivot(input.overlay);
  const angleDegrees =
    input.overlay.evaluatedAngleDegrees ?? input.overlay.restAngleDegrees ?? 0;
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const radius = getRotationDeformerAngleHandleRadius(input.overlay, input.view.zoom);
  const angleHandle = {
    x: pivot.x + Math.cos(angleRadians) * radius,
    y: pivot.y + Math.sin(angleRadians) * radius
  };

  return [
    {
      kind: "pivot",
      canvasPoint: pivot,
      screenPoint: canvasToScreenPoint(pivot, input.view)
    },
    {
      kind: "angle",
      canvasPoint: angleHandle,
      screenPoint: canvasToScreenPoint(angleHandle, input.view)
    }
  ];
}

export function hitTestRotationDeformerHandle(input: {
  readonly overlay: CanvasDeformerOverlayProjection;
  readonly view: CanvasViewState;
  readonly screenPoint: CanvasPoint;
  readonly pivotTolerancePx?: number;
  readonly angleTolerancePx?: number;
}): RotationDeformerHandlePosition | undefined {
  if (input.overlay.kind !== "rotation" || input.overlay.status !== "committed") {
    return undefined;
  }

  const handles = listRotationDeformerHandlePositions({
    overlay: input.overlay,
    view: input.view
  });
  const pivot = handles.find((handle) => handle.kind === "pivot");
  if (
    pivot !== undefined &&
    distance(pivot.screenPoint, input.screenPoint) <=
      (input.pivotTolerancePx ?? PIVOT_HIT_TOLERANCE_PX)
  ) {
    return pivot;
  }

  const angle = handles.find((handle) => handle.kind === "angle");
  if (
    angle !== undefined &&
    distance(angle.screenPoint, input.screenPoint) <=
      (input.angleTolerancePx ?? ANGLE_HIT_TOLERANCE_PX)
  ) {
    return angle;
  }

  return undefined;
}

export function resolveRotationAngleDegreesFromScreenPoint(input: {
  readonly pivot: CanvasPoint;
  readonly screenPoint: CanvasPoint;
  readonly view: CanvasViewState;
  readonly fallbackAngleDegrees: number;
}): number {
  const canvasPoint = screenToCanvasPoint(input.screenPoint, input.view);
  const dx = canvasPoint.x - input.pivot.x;
  const dy = canvasPoint.y - input.pivot.y;
  if (Math.abs(dx) < 0.000001 && Math.abs(dy) < 0.000001) {
    return normalizeAngleDegrees(input.fallbackAngleDegrees);
  }

  return normalizeAngleDegrees((Math.atan2(dy, dx) * 180) / Math.PI);
}

export function offsetCanvasPoint(
  point: CanvasPoint,
  delta: CanvasPoint
): CanvasPoint {
  return {
    x: normalizeCanvasNumber(point.x + delta.x),
    y: normalizeCanvasNumber(point.y + delta.y)
  };
}

export function areCanvasPointsEqual(left: CanvasPoint, right: CanvasPoint): boolean {
  return Math.abs(left.x - right.x) <= 0.000001 && Math.abs(left.y - right.y) <= 0.000001;
}

export function areAnglesEqual(left: number, right: number): boolean {
  return Math.abs(normalizeAngleDegrees(left) - normalizeAngleDegrees(right)) <= 0.000001;
}

export function normalizeAngleDegrees(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  let normalized = value % 360;
  if (normalized > 180) {
    normalized -= 360;
  }
  if (normalized <= -180) {
    normalized += 360;
  }

  return normalizeCanvasNumber(normalized);
}

function distance(left: CanvasPoint, right: CanvasPoint): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function normalizeCanvasNumber(value: number): number {
  if (Math.abs(value) < 1e-12) {
    return 0;
  }

  return Number(value.toFixed(12));
}
