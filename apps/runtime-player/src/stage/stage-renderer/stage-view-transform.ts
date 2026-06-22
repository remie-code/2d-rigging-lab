import type { RenderViewportTransform } from "@private-2d-rigging-lab/render-core";

export interface StageViewportPoint {
  readonly x: number;
  readonly y: number;
}

export interface StageViewTransform {
  readonly zoomScale: number;
  readonly pan: StageViewportPoint;
}

export interface ApplyStageWheelZoomInput {
  readonly transform: StageViewTransform;
  readonly wheelDeltaY: number;
  readonly anchor: StageViewportPoint;
  readonly minZoomScale?: number;
  readonly maxZoomScale?: number;
  readonly zoomSensitivity?: number;
}

const defaultMinZoomScale = 0.1;
const defaultMaxZoomScale = 12;
const defaultZoomSensitivity = 0.0015;

export function createResetStageViewTransform(): StageViewTransform {
  return {
    zoomScale: 1,
    pan: {
      x: 0,
      y: 0
    }
  };
}

export function applyStagePanDelta(
  transform: StageViewTransform,
  delta: StageViewportPoint
): StageViewTransform {
  return {
    zoomScale: normalizeZoomScale(transform.zoomScale),
    pan: {
      x: normalizeNumber(transform.pan.x) + normalizeNumber(delta.x),
      y: normalizeNumber(transform.pan.y) + normalizeNumber(delta.y)
    }
  };
}

export function applyStageWheelZoom(
  input: ApplyStageWheelZoomInput
): StageViewTransform {
  const minZoomScale = normalizePositiveNumber(
    input.minZoomScale,
    defaultMinZoomScale
  );
  const maxZoomScale = Math.max(
    minZoomScale,
    normalizePositiveNumber(input.maxZoomScale, defaultMaxZoomScale)
  );
  const zoomSensitivity = normalizePositiveNumber(
    input.zoomSensitivity,
    defaultZoomSensitivity
  );
  const currentZoomScale = clamp(
    normalizeZoomScale(input.transform.zoomScale),
    minZoomScale,
    maxZoomScale
  );
  const wheelDeltaY = normalizeNumber(input.wheelDeltaY);
  const nextZoomScale = clamp(
    currentZoomScale * Math.exp(-wheelDeltaY * zoomSensitivity),
    minZoomScale,
    maxZoomScale
  );

  if (nextZoomScale === currentZoomScale) {
    return {
      zoomScale: currentZoomScale,
      pan: {
        x: normalizeNumber(input.transform.pan.x),
        y: normalizeNumber(input.transform.pan.y)
      }
    };
  }

  const anchor = {
    x: normalizeNumber(input.anchor.x),
    y: normalizeNumber(input.anchor.y)
  };
  const zoomRatio = nextZoomScale / currentZoomScale;

  return {
    zoomScale: nextZoomScale,
    pan: {
      x: anchor.x - (anchor.x - input.transform.pan.x) * zoomRatio,
      y: anchor.y - (anchor.y - input.transform.pan.y) * zoomRatio
    }
  };
}

export function composeStageViewportTransform(
  initialTransform: RenderViewportTransform,
  viewTransform: StageViewTransform
): RenderViewportTransform {
  const zoomScale = normalizeZoomScale(viewTransform.zoomScale);

  return {
    scale: initialTransform.scale * zoomScale,
    translate: {
      x: initialTransform.translate.x * zoomScale + viewTransform.pan.x,
      y: initialTransform.translate.y * zoomScale + viewTransform.pan.y
    }
  };
}

function normalizeZoomScale(value: number): number {
  return normalizePositiveNumber(value, 1);
}

function normalizePositiveNumber(
  value: number | undefined,
  fallback: number
): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function normalizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
