import type {
  CanvasRenderableDrawable,
  CanvasRenderProjection,
  CanvasViewState
} from "./canvas-projection";
import { hasIsolatableCanvasSelection, isRenderableDrawable } from "./canvas-projection";

export interface CanvasOverlayState {
  readonly grid: boolean;
  readonly canvasBounds: boolean;
  readonly selectionBounds: boolean;
  readonly mesh: boolean;
  readonly isolateSelected: boolean;
}

export interface CanvasBitmapCache {
  readonly layerCanvases: Map<string, HTMLCanvasElement>;
}

export function createCanvasBitmapCache(): CanvasBitmapCache {
  return {
    layerCanvases: new Map()
  };
}

export function renderCanvasProjection(input: {
  readonly canvas: HTMLCanvasElement;
  readonly projection: CanvasRenderProjection;
  readonly view: CanvasViewState;
  readonly overlays: CanvasOverlayState;
  readonly cache: CanvasBitmapCache;
}): void {
  const viewport = {
    width: input.canvas.clientWidth,
    height: input.canvas.clientHeight
  };
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const nextWidth = Math.max(1, Math.round(viewport.width * pixelRatio));
  const nextHeight = Math.max(1, Math.round(viewport.height * pixelRatio));

  if (input.canvas.width !== nextWidth || input.canvas.height !== nextHeight) {
    input.canvas.width = nextWidth;
    input.canvas.height = nextHeight;
  }

  const context = input.canvas.getContext("2d");
  if (context === null) {
    return;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);
  fillPanelBackground(context, viewport.width, viewport.height);

  context.save();
  context.translate(input.view.pan.x, input.view.pan.y);
  context.scale(input.view.zoom, input.view.zoom);

  if (input.overlays.grid) {
    drawGrid(context, input.projection, input.view.zoom);
  }

  drawOrigin(context, input.projection, input.view.zoom);

  if (input.overlays.canvasBounds) {
    drawCanvasBounds(context, input.projection, input.view.zoom);
  }

  drawDrawableStack(context, input.projection, input.overlays, input.cache);

  if (input.overlays.selectionBounds) {
    drawSelectionOverlay(context, input.projection, input.view.zoom);
  }

  if (input.overlays.mesh) {
    drawMeshOverlay(context, input.projection, input.view.zoom);
  }

  context.restore();
}

function drawDrawableStack(
  context: CanvasRenderingContext2D,
  projection: CanvasRenderProjection,
  overlays: CanvasOverlayState,
  cache: CanvasBitmapCache
): void {
  const drawablesById = new Map(projection.drawables.map((drawable) => [drawable.drawableId, drawable]));
  const hasSelection = hasIsolatableCanvasSelection(projection);

  for (const drawable of projection.drawables) {
    if (!drawable.visible || !isRenderableDrawable(drawable)) {
      continue;
    }

    const maskSources = drawable.maskSourceDrawableIds
      .map((drawableId) => drawablesById.get(drawableId))
      .filter((mask): mask is CanvasRenderableDrawable =>
        mask !== undefined && mask.visible && isRenderableDrawable(mask)
      );
    if (!drawable.meshPreview && drawable.maskSourceDrawableIds.length > 0 && maskSources.length === 0) {
      continue;
    }

    context.save();
    context.globalAlpha = resolveDrawableAlpha(drawable, overlays, hasSelection);

    if (!drawable.meshPreview && maskSources.length > 0) {
      drawClippedDrawable(context, drawable, maskSources, cache);
    } else {
      drawDrawableImage(context, drawable, cache);
    }

    context.restore();
  }
}

function drawMeshOverlay(
  context: CanvasRenderingContext2D,
  projection: CanvasRenderProjection,
  zoom: number
): void {
  const overlay = projection.meshOverlay;
  if (overlay === undefined) {
    return;
  }

  const color =
    overlay.status === "draft"
      ? "rgba(251, 191, 36, 0.96)"
      : "rgba(45, 212, 191, 0.94)";
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1.25 / zoom;
  context.setLineDash(overlay.status === "draft" ? [7 / zoom, 5 / zoom] : []);

  for (const triangle of overlay.mesh.triangles) {
    const [aIndex, bIndex, cIndex] = triangle;
    const a = overlay.mesh.vertices[aIndex];
    const b = overlay.mesh.vertices[bIndex];
    const c = overlay.mesh.vertices[cIndex];
    if (a === undefined || b === undefined || c === undefined) {
      continue;
    }

    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.lineTo(c.x, c.y);
    context.closePath();
    context.stroke();
  }

  context.setLineDash([]);
  const radius = Math.max(2 / zoom, 1.25 / zoom);
  for (const vertex of overlay.mesh.vertices) {
    context.beginPath();
    context.arc(vertex.x, vertex.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawDrawableImage(
  context: CanvasRenderingContext2D,
  drawable: CanvasRenderableDrawable,
  cache: CanvasBitmapCache
): void {
  const image = getLayerCanvas(drawable, cache);
  if (image === undefined) {
    return;
  }

  context.drawImage(
    image,
    drawable.bounds.x,
    drawable.bounds.y,
    drawable.bounds.width,
    drawable.bounds.height
  );
}

function drawClippedDrawable(
  context: CanvasRenderingContext2D,
  drawable: CanvasRenderableDrawable,
  maskSources: readonly CanvasRenderableDrawable[],
  cache: CanvasBitmapCache
): void {
  const targetImage = getLayerCanvas(drawable, cache);
  if (targetImage === undefined) {
    return;
  }

  const bounds = unionStageBounds([drawable, ...maskSources]);
  const scratch = document.createElement("canvas");
  const mask = document.createElement("canvas");
  scratch.width = Math.max(1, Math.ceil(bounds.width));
  scratch.height = Math.max(1, Math.ceil(bounds.height));
  mask.width = scratch.width;
  mask.height = scratch.height;
  const scratchContext = scratch.getContext("2d");
  const maskContext = mask.getContext("2d");
  if (scratchContext === null || maskContext === null) {
    return;
  }

  scratchContext.drawImage(
    targetImage,
    drawable.bounds.x - bounds.x,
    drawable.bounds.y - bounds.y,
    drawable.bounds.width,
    drawable.bounds.height
  );

  for (const maskSource of maskSources) {
    const maskImage = getLayerCanvas(maskSource, cache);
    if (maskImage === undefined) {
      continue;
    }

    maskContext.save();
    maskContext.globalAlpha = maskSource.opacity;
    maskContext.drawImage(
      maskImage,
      maskSource.bounds.x - bounds.x,
      maskSource.bounds.y - bounds.y,
      maskSource.bounds.width,
      maskSource.bounds.height
    );
    maskContext.restore();
  }

  scratchContext.globalCompositeOperation = "destination-in";
  scratchContext.drawImage(mask, 0, 0);
  scratchContext.globalCompositeOperation = "source-over";
  context.drawImage(scratch, bounds.x, bounds.y, bounds.width, bounds.height);
}

function getLayerCanvas(
  drawable: CanvasRenderableDrawable,
  cache: CanvasBitmapCache
): HTMLCanvasElement | undefined {
  if (!isRenderableDrawable(drawable)) {
    return undefined;
  }

  const cacheKey = `${drawable.binaryAssetId ?? drawable.drawableId}:${drawable.renderWidth}x${drawable.renderHeight}:${drawable.renderBytes.byteLength}`;
  const cached = cache.layerCanvases.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const imageCanvas = document.createElement("canvas");
  imageCanvas.width = drawable.renderWidth;
  imageCanvas.height = drawable.renderHeight;
  const imageContext = imageCanvas.getContext("2d");
  if (imageContext === null) {
    return undefined;
  }

  const imageData = new ImageData(
    new Uint8ClampedArray(drawable.renderBytes),
    drawable.renderWidth,
    drawable.renderHeight
  );
  imageContext.putImageData(imageData, 0, 0);
  cache.layerCanvases.set(cacheKey, imageCanvas);

  return imageCanvas;
}

function resolveDrawableAlpha(
  drawable: CanvasRenderableDrawable,
  overlays: CanvasOverlayState,
  hasSelection: boolean
): number {
  const isolateDim = overlays.isolateSelected && hasSelection && !drawable.selected && !drawable.selectedBySubtree
    ? 0.22
    : 1;

  return drawable.opacity * isolateDim;
}

function drawGrid(
  context: CanvasRenderingContext2D,
  projection: CanvasRenderProjection,
  zoom: number
): void {
  const bounds = projection.canvasBounds;
  const interval = chooseGridInterval(zoom);
  const left = Math.floor(bounds.x / interval) * interval;
  const right = bounds.x + bounds.width;
  const top = Math.floor(bounds.y / interval) * interval;
  const bottom = bounds.y + bounds.height;

  context.save();
  context.strokeStyle = "rgba(120, 124, 119, 0.2)";
  context.lineWidth = 1 / zoom;
  context.beginPath();

  for (let x = left; x <= right; x += interval) {
    context.moveTo(x, bounds.y);
    context.lineTo(x, bottom);
  }

  for (let y = top; y <= bottom; y += interval) {
    context.moveTo(bounds.x, y);
    context.lineTo(right, y);
  }

  context.stroke();
  context.restore();
}

function drawOrigin(
  context: CanvasRenderingContext2D,
  projection: CanvasRenderProjection,
  zoom: number
): void {
  const bounds = projection.canvasBounds;

  context.save();
  context.strokeStyle = "rgba(20, 184, 166, 0.42)";
  context.lineWidth = 1.25 / zoom;
  context.beginPath();
  context.moveTo(bounds.x, 0);
  context.lineTo(bounds.x + bounds.width, 0);
  context.moveTo(0, bounds.y);
  context.lineTo(0, bounds.y + bounds.height);
  context.stroke();
  context.restore();
}

function drawCanvasBounds(
  context: CanvasRenderingContext2D,
  projection: CanvasRenderProjection,
  zoom: number
): void {
  const bounds = projection.canvasBounds;

  context.save();
  context.strokeStyle = "rgba(229, 231, 235, 0.45)";
  context.lineWidth = 1.5 / zoom;
  context.setLineDash([8 / zoom, 6 / zoom]);
  context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  context.restore();
}

function drawSelectionOverlay(
  context: CanvasRenderingContext2D,
  projection: CanvasRenderProjection,
  zoom: number
): void {
  context.save();
  context.lineWidth = 2 / zoom;
  context.strokeStyle = "rgba(45, 212, 191, 0.95)";
  context.setLineDash([]);

  for (const drawable of projection.drawables) {
    if (
      (!drawable.selected && !drawable.selectedBySubtree) ||
      !drawable.visible ||
      drawable.bounds.width <= 0 ||
      drawable.bounds.height <= 0
    ) {
      continue;
    }

    context.strokeRect(
      drawable.bounds.x,
      drawable.bounds.y,
      drawable.bounds.width,
      drawable.bounds.height
    );
  }

  if (projection.selectionBounds !== undefined) {
    context.strokeStyle = "rgba(94, 234, 212, 0.82)";
    context.setLineDash([10 / zoom, 5 / zoom]);
    context.strokeRect(
      projection.selectionBounds.x,
      projection.selectionBounds.y,
      projection.selectionBounds.width,
      projection.selectionBounds.height
    );
  }

  context.restore();
}

function fillPanelBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  context.fillStyle = "#111211";
  context.fillRect(0, 0, width, height);
}

function chooseGridInterval(zoom: number): number {
  if (zoom >= 2) {
    return 25;
  }

  if (zoom >= 0.8) {
    return 50;
  }

  if (zoom >= 0.35) {
    return 100;
  }

  return 250;
}

function unionStageBounds(drawables: readonly CanvasRenderableDrawable[]): {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
} {
  const left = Math.min(...drawables.map((drawable) => drawable.bounds.x));
  const top = Math.min(...drawables.map((drawable) => drawable.bounds.y));
  const right = Math.max(
    ...drawables.map((drawable) => drawable.bounds.x + drawable.bounds.width)
  );
  const bottom = Math.max(
    ...drawables.map((drawable) => drawable.bounds.y + drawable.bounds.height)
  );

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}
