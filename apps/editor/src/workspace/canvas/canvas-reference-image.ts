import {
  modelPointToReferenceImage,
  referenceImagePointToModel,
  updateReferenceImageState
} from "@private-2d-rigging-lab/authoring-core";
import type { ReferenceImageState } from "@private-2d-rigging-lab/contracts";
import {
  canvasToScreenPoint,
  screenToCanvasPoint,
  type CanvasPoint,
  type CanvasViewState
} from "./canvas-projection";

const HANDLE_RADIUS = 7;
const ROTATION_HANDLE_OFFSET = 24;

export type ReferenceImageGesture = "move" | "scale" | "rotate" | "pivot";

function referenceHandles(state: ReferenceImageState, view: CanvasViewState) {
  const { width, height } = state.image;
  const { transform } = state;
  const toScreen = (point: CanvasPoint) =>
    canvasToScreenPoint(referenceImagePointToModel(transform, point), view);
  const corners = [
    toScreen({ x: 0, y: 0 }),
    toScreen({ x: width, y: 0 }),
    toScreen({ x: width, y: height }),
    toScreen({ x: 0, y: height })
  ];
  const top = toScreen({ x: width / 2, y: 0 });
  const angle = transform.rotationDegrees * Math.PI / 180;
  const rotation = {
    x: top.x + ROTATION_HANDLE_OFFSET * Math.sin(angle),
    y: top.y - ROTATION_HANDLE_OFFSET * Math.cos(angle)
  };
  return { corners, top, rotation, pivot: toScreen(transform.pivot) };
}

export function getReferenceImageGesture(
  state: ReferenceImageState,
  view: CanvasViewState,
  screen: CanvasPoint,
  placePivot: boolean
): ReferenceImageGesture | undefined {
  const { corners, rotation, pivot } = referenceHandles(state, view);
  const near = (point: CanvasPoint) =>
    Math.hypot(screen.x - point.x, screen.y - point.y) <= HANDLE_RADIUS;
  const image = modelPointToReferenceImage(state.transform, screenToCanvasPoint(screen, view));
  const inside = image.x >= 0 && image.x <= state.image.width &&
    image.y >= 0 && image.y <= state.image.height;
  if (placePivot) return inside ? "pivot" : undefined;
  if (near(rotation)) return "rotate";
  if (corners.some((corner) => near(corner) && Math.hypot(corner.x - pivot.x, corner.y - pivot.y) > 1)) {
    return "scale";
  }
  return inside ? "move" : undefined;
}

export function previewReferenceImageGesture(input: {
  readonly state: ReferenceImageState;
  readonly gesture: ReferenceImageGesture;
  readonly start: CanvasPoint;
  readonly current: CanvasPoint;
}): ReferenceImageState {
  const { state, gesture, start, current } = input;
  const { transform } = state;
  if (gesture === "pivot") {
    const point = modelPointToReferenceImage(transform, current);
    return updateReferenceImageState(state, { pivot: {
      x: Math.max(0, Math.min(state.image.width, point.x)),
      y: Math.max(0, Math.min(state.image.height, point.y))
    } });
  }
  if (start.x === current.x && start.y === current.y) return state;
  if (gesture === "move") {
    return updateReferenceImageState(state, {
      translation: { x: current.x - start.x, y: current.y - start.y }
    });
  }
  const pivot = referenceImagePointToModel(transform, transform.pivot);
  const from = { x: start.x - pivot.x, y: start.y - pivot.y };
  const to = { x: current.x - pivot.x, y: current.y - pivot.y };
  if (gesture === "scale") {
    const initialDistance = Math.hypot(from.x, from.y);
    if (initialDistance === 0) return state;
    const factor = Math.max(0.001, Math.hypot(to.x, to.y) / initialDistance);
    return updateReferenceImageState(state, { scale: transform.scale * factor });
  }
  const delta = Math.atan2(to.y, to.x) - Math.atan2(from.y, from.x);
  return updateReferenceImageState(state, {
    rotationDegrees: transform.rotationDegrees + delta * 180 / Math.PI
  });
}

export function drawReferenceImage(
  context: CanvasRenderingContext2D,
  state: ReferenceImageState,
  bitmap: ImageBitmap
): void {
  const { origin, rotationDegrees, scale } = state.transform;
  context.save();
  context.globalAlpha = state.opacity;
  context.translate(origin.x, origin.y);
  context.rotate(rotationDegrees * Math.PI / 180);
  context.scale(scale, scale);
  context.drawImage(bitmap, 0, 0);
  context.restore();
}

export function drawReferenceImageHandles(
  context: CanvasRenderingContext2D,
  state: ReferenceImageState,
  view: CanvasViewState
): void {
  const { corners, top, rotation, pivot } = referenceHandles(state, view);
  const [first, ...rest] = corners;
  if (first === undefined) return;
  context.save();
  context.strokeStyle = "#5eead4";
  context.fillStyle = "#101817";
  context.lineWidth = 1.5;
  context.shadowColor = "#000";
  context.shadowBlur = 3;
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const corner of rest) context.lineTo(corner.x, corner.y);
  context.closePath();
  context.moveTo(top.x, top.y);
  context.lineTo(rotation.x, rotation.y);
  context.stroke();
  for (const point of corners) {
    context.fillRect(point.x - 4, point.y - 4, 8, 8);
    context.strokeRect(point.x - 4, point.y - 4, 8, 8);
  }
  context.beginPath();
  context.arc(rotation.x, rotation.y, 5, 0, 2 * Math.PI);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(pivot.x - 8, pivot.y);
  context.lineTo(pivot.x + 8, pivot.y);
  context.moveTo(pivot.x, pivot.y - 8);
  context.lineTo(pivot.x, pivot.y + 8);
  context.stroke();
  context.restore();
}
