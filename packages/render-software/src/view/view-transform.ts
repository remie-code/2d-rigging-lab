import type { RenderPoint } from "@private-2d-rigging-lab/render-core";

/**
 * A rectangle in stage (model) space that is mapped onto the full output image.
 *
 * The rectangle is expressed by its minimum corner and its extents. In stage
 * space the +Y axis points down (coordinateSystem "stage-y-down-v1"), so
 * `minY` is the top edge of the visible region and `minY + height` is the
 * bottom edge. The full stage rectangle is mapped affinely onto the output
 * image so that:
 *
 *   stage (minX, minY)                  -> image top-left    (pixel edge 0,0)
 *   stage (minX + width, minY + height) -> image bottom-right(pixel edge W,H)
 *
 * Stage +Y (downward) therefore maps to increasing image rows (downward),
 * matching the WebGL2 renderer's on-screen orientation.
 */
export interface StageViewportRect {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A complete view specification: which stage rectangle is visible and at what
 * output pixel resolution it is rasterized. This is the public, serializable
 * contract the Wave104 view-transform sidecar reuses to record px <-> stage
 * correspondences.
 */
export interface SoftwareRenderView {
  readonly stageViewport: StageViewportRect;
  readonly outputWidth: number;
  readonly outputHeight: number;
}

/**
 * The resolved, deterministic affine transform derived from a
 * {@link SoftwareRenderView}. All inputs are normalized (output size floored to
 * at least 1, non-finite / degenerate stage extents replaced by unit extents)
 * so the transform is always invertible and platform-independent.
 */
export interface ResolvedSoftwareRenderView {
  readonly outputWidth: number;
  readonly outputHeight: number;
  readonly stageViewport: StageViewportRect;
  /** Scale from stage X units to output pixels. */
  readonly pixelsPerStageX: number;
  /** Scale from stage Y units to output pixels. */
  readonly pixelsPerStageY: number;
}

function normalizeExtent(value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    return 1;
  }
  return value;
}

function normalizeOrigin(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function normalizeOutputDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value));
}

/**
 * Resolve a raw view specification into a deterministic, always-invertible
 * transform. Pure and referentially transparent: identical input yields an
 * identical resolved view.
 */
export const resolveSoftwareRenderView = (
  view: SoftwareRenderView
): ResolvedSoftwareRenderView => {
  const outputWidth = normalizeOutputDimension(view.outputWidth);
  const outputHeight = normalizeOutputDimension(view.outputHeight);
  const stageViewport: StageViewportRect = {
    minX: normalizeOrigin(view.stageViewport.minX),
    minY: normalizeOrigin(view.stageViewport.minY),
    width: normalizeExtent(view.stageViewport.width),
    height: normalizeExtent(view.stageViewport.height)
  };

  return {
    outputWidth,
    outputHeight,
    stageViewport,
    pixelsPerStageX: outputWidth / stageViewport.width,
    pixelsPerStageY: outputHeight / stageViewport.height
  };
};

/**
 * Forward transform: map a stage-space point to output image pixel
 * coordinates. The returned coordinate is in continuous pixel space where the
 * image spans [0, outputWidth] x [0, outputHeight] and a pixel with integer
 * index (px, py) has its center at (px + 0.5, py + 0.5).
 */
export const stagePointToImagePixel = (
  view: ResolvedSoftwareRenderView,
  point: RenderPoint
): RenderPoint => ({
  x: (point.x - view.stageViewport.minX) * view.pixelsPerStageX,
  y: (point.y - view.stageViewport.minY) * view.pixelsPerStageY
});

/**
 * Inverse transform: map an output image pixel coordinate back to stage space.
 * This is the exact inverse of {@link stagePointToImagePixel}; the round trip
 * is deterministic and (up to floating point) identity.
 */
export const imagePixelToStagePoint = (
  view: ResolvedSoftwareRenderView,
  pixel: RenderPoint
): RenderPoint => ({
  x: view.stageViewport.minX + pixel.x / view.pixelsPerStageX,
  y: view.stageViewport.minY + pixel.y / view.pixelsPerStageY
});

/**
 * Map an integer pixel index (px, py) to the stage-space point sampled for that
 * pixel, i.e. the inverse image of the pixel center (px + 0.5, py + 0.5). This
 * is the exact point the rasterizer tests against triangles.
 */
export const pixelCenterToStagePoint = (
  view: ResolvedSoftwareRenderView,
  px: number,
  py: number
): RenderPoint =>
  imagePixelToStagePoint(view, { x: px + 0.5, y: py + 0.5 });
