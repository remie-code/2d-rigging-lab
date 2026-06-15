import { WebGl2Renderer, type WebGl2Like } from "@private-2d-rigging-lab/render-webgl2";

import type {
  CanvasDeformerOverlayProjection,
  CanvasRenderableDrawable,
  CanvasRenderProjection,
  CanvasViewState
} from "./canvas-projection";
import { hasIsolatableCanvasSelection, isRenderableDrawable } from "./canvas-projection";
import { createRenderSceneFromCanvasProjection } from "./canvas-render-scene-adapter";
import { resolveTriangleTextureWarpTransform } from "./canvas-triangle-texture-warp";
import {
  getRotationDeformerPivot,
  listRotationDeformerHandlePositions
} from "./rotation-deformer-handles";
import { getWarpControlPointCanvasPosition } from "./warp-deformer-control-points";

export interface CanvasOverlayState {
  readonly grid: boolean;
  readonly canvasBounds: boolean;
  readonly selectionBounds: boolean;
  readonly mesh: boolean;
  readonly deformer: boolean;
  readonly isolateSelected: boolean;
}

export interface CanvasBitmapCache {
  readonly layerCanvases: Map<string, HTMLCanvasElement>;
  readonly webglDrawableStack: CanvasWebGlDrawableStackCache;
}

interface CanvasWebGlDrawableStackCache {
  canvas?: HTMLCanvasElement | undefined;
  renderer?: WebGl2Renderer | undefined;
  disabled: boolean;
}

export interface CanvasWarpDeformerInteractionState {
  readonly rigControlId: string;
  readonly editable: boolean;
  readonly selectedControlPointIndices: readonly number[];
  readonly hoveredControlPointIndex?: number;
}

export interface CanvasRotationDeformerInteractionState {
  readonly rigControlId: string;
  readonly pivotEditable: boolean;
  readonly angleEditable: boolean;
  readonly hoveredHandle?: "pivot" | "angle";
}

export function createCanvasBitmapCache(): CanvasBitmapCache {
  return {
    layerCanvases: new Map(),
    webglDrawableStack: {
      disabled: false
    }
  };
}

export function disposeCanvasBitmapCache(cache: CanvasBitmapCache): void {
  cache.layerCanvases.clear();
  cache.webglDrawableStack.renderer?.dispose();
  cache.webglDrawableStack.renderer = undefined;
  cache.webglDrawableStack.canvas = undefined;
  cache.webglDrawableStack.disabled = false;
}

export function renderCanvasProjection(input: {
  readonly canvas: HTMLCanvasElement;
  readonly projection: CanvasRenderProjection;
  readonly view: CanvasViewState;
  readonly overlays: CanvasOverlayState;
  readonly cache: CanvasBitmapCache;
  readonly warpDeformerInteraction?: CanvasWarpDeformerInteractionState | undefined;
  readonly rotationDeformerInteraction?: CanvasRotationDeformerInteractionState | undefined;
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
  applyStageTransform(context, input.view);

  if (input.overlays.grid) {
    drawGrid(context, input.projection, input.view.zoom);
  }

  drawOrigin(context, input.projection, input.view.zoom);

  if (input.overlays.canvasBounds) {
    drawCanvasBounds(context, input.projection, input.view.zoom);
  }
  context.restore();

  const drewDrawableStackWithWebGl = drawDrawableStackWithWebGl({
    context,
    projection: input.projection,
    view: input.view,
    overlays: input.overlays,
    cache: input.cache,
    viewport,
    pixelRatio
  });

  context.save();
  applyStageTransform(context, input.view);
  if (!drewDrawableStackWithWebGl) {
    drawDrawableStack(context, input.projection, input.overlays, input.cache);
  }

  if (input.overlays.selectionBounds) {
    drawSelectionOverlay(context, input.projection, input.view.zoom);
  }

  if (input.overlays.deformer) {
    drawDeformerOverlay(
      context,
      input.projection,
      input.view.zoom,
      input.warpDeformerInteraction,
      input.rotationDeformerInteraction
    );
  }

  if (input.overlays.mesh) {
    drawMeshOverlay(context, input.projection, input.view.zoom);
  }

  context.restore();
}

function applyStageTransform(context: CanvasRenderingContext2D, view: CanvasViewState): void {
  context.translate(view.pan.x, view.pan.y);
  context.scale(view.zoom, view.zoom);
}

function drawDrawableStackWithWebGl(input: {
  readonly context: CanvasRenderingContext2D;
  readonly projection: CanvasRenderProjection;
  readonly view: CanvasViewState;
  readonly overlays: CanvasOverlayState;
  readonly cache: CanvasBitmapCache;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly pixelRatio: number;
}): boolean {
  const stack = getWebGlDrawableStack(input.cache);
  if (stack === undefined) {
    return false;
  }

  const nextWidth = Math.max(1, Math.round(input.viewport.width * input.pixelRatio));
  const nextHeight = Math.max(1, Math.round(input.viewport.height * input.pixelRatio));
  if (stack.canvas.width !== nextWidth || stack.canvas.height !== nextHeight) {
    stack.canvas.width = nextWidth;
    stack.canvas.height = nextHeight;
  }

  try {
    stack.renderer.render(
      createRenderSceneFromCanvasProjection(input.projection, {
        isolateSelected: input.overlays.isolateSelected
      }),
      {
        width: nextWidth,
        height: nextHeight,
        stageToViewport: {
          scale: input.view.zoom * input.pixelRatio,
          translate: {
            x: input.view.pan.x * input.pixelRatio,
            y: input.view.pan.y * input.pixelRatio
          }
        }
      }
    );
    input.context.drawImage(stack.canvas, 0, 0, input.viewport.width, input.viewport.height);
    return true;
  } catch {
    stack.renderer.dispose();
    input.cache.webglDrawableStack.renderer = undefined;
    input.cache.webglDrawableStack.disabled = true;
    return false;
  }
}

function getWebGlDrawableStack(cache: CanvasBitmapCache): {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: WebGl2Renderer;
} | undefined {
  if (cache.webglDrawableStack.disabled) {
    return undefined;
  }

  const canvas = cache.webglDrawableStack.canvas ?? document.createElement("canvas");
  cache.webglDrawableStack.canvas = canvas;

  if (cache.webglDrawableStack.renderer !== undefined) {
    return {
      canvas,
      renderer: cache.webglDrawableStack.renderer
    };
  }

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    stencil: false
  }) as WebGl2Like | null;
  if (gl === null) {
    cache.webglDrawableStack.disabled = true;
    return undefined;
  }

  try {
    const renderer = new WebGl2Renderer(gl);
    cache.webglDrawableStack.renderer = renderer;
    return {
      canvas,
      renderer
    };
  } catch {
    cache.webglDrawableStack.disabled = true;
    return undefined;
  }
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

function drawDeformerOverlay(
  context: CanvasRenderingContext2D,
  projection: CanvasRenderProjection,
  zoom: number,
  warpInteraction: CanvasWarpDeformerInteractionState | undefined,
  rotationInteraction: CanvasRotationDeformerInteractionState | undefined
): void {
  const overlay = projection.deformerOverlay;
  if (overlay === undefined) {
    return;
  }

  const color =
    overlay.status === "draft"
      ? "rgba(251, 191, 36, 0.98)"
      : "rgba(45, 212, 191, 0.96)";
  const guideColor =
    overlay.status === "draft"
      ? "rgba(125, 211, 252, 0.46)"
      : "rgba(251, 113, 133, 0.36)";

  if (overlay.kind === "rotation") {
    drawRotationDeformerOverlay(
      context,
      overlay,
      zoom,
      color,
      overlay.rigControlId === rotationInteraction?.rigControlId ? rotationInteraction : undefined
    );
    return;
  }

  context.save();
  context.lineWidth = 1.5 / zoom;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.setLineDash(overlay.status === "draft" ? [8 / zoom, 5 / zoom] : []);
  context.strokeRect(
    overlay.domainBounds.x,
    overlay.domainBounds.y,
    overlay.domainBounds.width,
    overlay.domainBounds.height
  );

  drawDeformerGridLines(context, overlay, zoom, "transform", color);
  drawDeformerControlPoints(
    context,
    overlay,
    zoom,
    color,
    overlay.rigControlId === warpInteraction?.rigControlId ? warpInteraction : undefined
  );

  context.strokeStyle = guideColor;
  context.lineWidth = 1 / zoom;
  context.setLineDash([2 / zoom, 5 / zoom]);
  drawDeformerGridLines(context, overlay, zoom, "bezier", guideColor);
  context.restore();
}

function drawRotationDeformerOverlay(
  context: CanvasRenderingContext2D,
  overlay: CanvasDeformerOverlayProjection,
  zoom: number,
  color: string,
  interaction: CanvasRotationDeformerInteractionState | undefined
): void {
  const pivot = getRotationDeformerPivot(overlay);
  const handles = listRotationDeformerHandlePositions({
    overlay,
    view: {
      zoom,
      pan: { x: 0, y: 0 }
    }
  });
  const angleHandle = handles.find((handle) => handle.kind === "angle")?.canvasPoint;
  const angleRadians = ((overlay.evaluatedAngleDegrees ?? overlay.restAngleDegrees ?? 0) * Math.PI) / 180;

  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1.5 / zoom;
  context.setLineDash([]);
  context.strokeRect(
    overlay.domainBounds.x,
    overlay.domainBounds.y,
    overlay.domainBounds.width,
    overlay.domainBounds.height
  );

  context.beginPath();
  context.moveTo(pivot.x - 7 / zoom, pivot.y);
  context.lineTo(pivot.x + 7 / zoom, pivot.y);
  context.moveTo(pivot.x, pivot.y - 7 / zoom);
  context.lineTo(pivot.x, pivot.y + 7 / zoom);
  context.stroke();

  context.fillStyle = resolveRotationHandleFill({
    baseColor: color,
    editable: interaction?.pivotEditable ?? true,
    hovered: interaction?.hoveredHandle === "pivot"
  });
  context.strokeStyle = "rgba(255, 255, 255, 0.72)";
  context.lineWidth = 1 / zoom;
  context.beginPath();
  context.arc(
    pivot.x,
    pivot.y,
    Math.max((interaction?.hoveredHandle === "pivot" ? 4.5 : 3) / zoom, 1.5 / zoom),
    0,
    Math.PI * 2
  );
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(
    pivot.x,
    pivot.y,
    Math.hypot(
      (angleHandle?.x ?? pivot.x) - pivot.x,
      (angleHandle?.y ?? pivot.y) - pivot.y
    ),
    -Math.PI * 0.25,
    Math.PI * 0.25
  );
  context.stroke();

  context.beginPath();
  context.moveTo(pivot.x, pivot.y);
  context.lineTo(
    angleHandle?.x ?? pivot.x + Math.cos(angleRadians) * 12 / zoom,
    angleHandle?.y ?? pivot.y + Math.sin(angleRadians) * 12 / zoom
  );
  context.stroke();

  if (angleHandle !== undefined) {
    context.fillStyle = resolveRotationHandleFill({
      baseColor: color,
      editable: interaction?.angleEditable ?? true,
      hovered: interaction?.hoveredHandle === "angle"
    });
    context.strokeStyle = "rgba(255, 255, 255, 0.72)";
    context.beginPath();
    context.arc(
      angleHandle.x,
      angleHandle.y,
      Math.max((interaction?.hoveredHandle === "angle" ? 4.5 : 3) / zoom, 1.5 / zoom),
      0,
      Math.PI * 2
    );
    context.fill();
    context.stroke();
  }
  context.restore();
}

function resolveRotationHandleFill(input: {
  readonly baseColor: string;
  readonly editable: boolean;
  readonly hovered: boolean;
}): string {
  if (!input.editable) {
    return input.hovered ? "rgba(209, 213, 219, 0.92)" : "rgba(156, 163, 175, 0.78)";
  }

  return input.hovered ? "rgba(255, 255, 255, 0.98)" : input.baseColor;
}

function drawDeformerGridLines(
  context: CanvasRenderingContext2D,
  overlay: CanvasDeformerOverlayProjection,
  zoom: number,
  kind: "transform" | "bezier",
  color: string
): void {
  const columns = kind === "transform" ? overlay.transformColumns : overlay.bezierColumns;
  const rows = kind === "transform" ? overlay.transformRows : overlay.bezierRows;
  if (kind === "transform" && hasControlPointOffsets(overlay, columns, rows)) {
    context.strokeStyle = color;
    context.beginPath();
    for (let row = 0; row < rows; row += 1) {
      const first = getWarpControlPointCanvasPosition(overlay, 0, row);
      context.moveTo(first.x, first.y);
      for (let column = 1; column < columns; column += 1) {
        const point = getWarpControlPointCanvasPosition(overlay, column, row);
        context.lineTo(point.x, point.y);
      }
    }

    for (let column = 0; column < columns; column += 1) {
      const first = getWarpControlPointCanvasPosition(overlay, column, 0);
      context.moveTo(first.x, first.y);
      for (let row = 1; row < rows; row += 1) {
        const point = getWarpControlPointCanvasPosition(overlay, column, row);
        context.lineTo(point.x, point.y);
      }
    }
    context.stroke();
    context.lineWidth = 1.5 / zoom;
    return;
  }

  const bounds = overlay.domainBounds;
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  context.strokeStyle = color;
  context.beginPath();
  for (let column = 0; column < columns; column += 1) {
    const x = bounds.x + bounds.width * toUnitGridPosition(column, columns);
    context.moveTo(x, bounds.y);
    context.lineTo(x, bottom);
  }

  for (let row = 0; row < rows; row += 1) {
    const y = bounds.y + bounds.height * toUnitGridPosition(row, rows);
    context.moveTo(bounds.x, y);
    context.lineTo(right, y);
  }

  context.stroke();
  context.lineWidth = kind === "transform" ? 1.5 / zoom : 1 / zoom;
}

function drawDeformerControlPoints(
  context: CanvasRenderingContext2D,
  overlay: CanvasDeformerOverlayProjection,
  zoom: number,
  color: string,
  interaction: CanvasWarpDeformerInteractionState | undefined
): void {
  const selectedIndices = new Set(interaction?.selectedControlPointIndices ?? []);
  const editable = interaction?.editable ?? true;
  for (let row = 0; row < overlay.transformRows; row += 1) {
    for (let column = 0; column < overlay.transformColumns; column += 1) {
      const index = row * overlay.transformColumns + column;
      const selected = selectedIndices.has(index);
      const hovered = interaction?.hoveredControlPointIndex === index;
      const radius = Math.max((selected || hovered ? 4 : 2.5) / zoom, 1.5 / zoom);
      const point = getWarpControlPointCanvasPosition(overlay, column, row);

      context.fillStyle = resolveControlPointFill({
        baseColor: color,
        editable,
        hovered,
        selected
      });
      context.strokeStyle = selected ? "rgba(17, 24, 39, 0.96)" : "rgba(255, 255, 255, 0.66)";
      context.lineWidth = (selected || hovered ? 1.5 : 0.75) / zoom;
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        radius,
        0,
        Math.PI * 2
      );
      context.fill();
      context.stroke();
    }
  }
}

function resolveControlPointFill(input: {
  readonly baseColor: string;
  readonly editable: boolean;
  readonly hovered: boolean;
  readonly selected: boolean;
}): string {
  if (input.selected) {
    return "rgba(253, 224, 71, 0.98)";
  }

  if (input.hovered && input.editable) {
    return "rgba(255, 255, 255, 0.98)";
  }

  if (!input.editable) {
    return input.hovered ? "rgba(209, 213, 219, 0.92)" : "rgba(156, 163, 175, 0.78)";
  }

  return input.baseColor;
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

  if (drawDrawableMeshImage(context, drawable, image)) {
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

  scratchContext.save();
  scratchContext.translate(-bounds.x, -bounds.y);
  drawDrawableImage(scratchContext, drawable, cache);
  scratchContext.restore();

  for (const maskSource of maskSources) {
    const maskImage = getLayerCanvas(maskSource, cache);
    if (maskImage === undefined) {
      continue;
    }

    maskContext.save();
    maskContext.globalAlpha = maskSource.opacity;
    maskContext.translate(-bounds.x, -bounds.y);
    drawDrawableImage(maskContext, maskSource, cache);
    maskContext.restore();
  }

  scratchContext.globalCompositeOperation = "destination-in";
  scratchContext.drawImage(mask, 0, 0);
  scratchContext.globalCompositeOperation = "source-over";
  context.drawImage(scratch, bounds.x, bounds.y, bounds.width, bounds.height);
}

function drawDrawableMeshImage(
  context: CanvasRenderingContext2D,
  drawable: CanvasRenderableDrawable,
  image: HTMLCanvasElement
): boolean {
  const mesh = drawable.evaluatedMesh;
  if (
    mesh.source === "rectFallback" ||
    mesh.vertices.length === 0 ||
    mesh.uvs.length === 0 ||
    mesh.triangles.length === 0
  ) {
    return false;
  }

  let drewTriangle = false;
  for (const triangle of mesh.triangles) {
    const [aIndex, bIndex, cIndex] = triangle;
    const destA = mesh.vertices[aIndex];
    const destB = mesh.vertices[bIndex];
    const destC = mesh.vertices[cIndex];
    const uvA = mesh.uvs[aIndex];
    const uvB = mesh.uvs[bIndex];
    const uvC = mesh.uvs[cIndex];
    if (
      destA === undefined ||
      destB === undefined ||
      destC === undefined ||
      uvA === undefined ||
      uvB === undefined ||
      uvC === undefined
    ) {
      continue;
    }

    const transform = resolveTriangleTextureWarpTransform({
      source: [
        uvToTexturePoint(uvA, image),
        uvToTexturePoint(uvB, image),
        uvToTexturePoint(uvC, image)
      ],
      destination: [destA, destB, destC]
    });
    if (transform === undefined) {
      continue;
    }

    context.save();
    context.beginPath();
    context.moveTo(destA.x, destA.y);
    context.lineTo(destB.x, destB.y);
    context.lineTo(destC.x, destC.y);
    context.closePath();
    context.clip();
    context.transform(
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f
    );
    context.drawImage(image, 0, 0);
    context.restore();
    drewTriangle = true;
  }

  return drewTriangle;
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

function uvToTexturePoint(
  uv: { readonly x: number; readonly y: number },
  image: HTMLCanvasElement
): { readonly x: number; readonly y: number } {
  return {
    x: uv.x * image.width,
    y: uv.y * image.height
  };
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

function toUnitGridPosition(index: number, size: number): number {
  return size <= 1 ? 0 : index / (size - 1);
}

function hasControlPointOffsets(
  overlay: CanvasDeformerOverlayProjection,
  columns: number,
  rows: number
): boolean {
  return (overlay.controlPointOffsets?.length ?? 0) >= columns * rows;
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
