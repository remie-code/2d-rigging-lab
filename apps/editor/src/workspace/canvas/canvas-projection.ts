import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId, RectDto } from "@private-2d-rigging-lab/contracts";

import type { EditorSelection } from "../../features/editor-session/model/editor-selection";

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export interface CanvasViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface CanvasViewState {
  readonly zoom: number;
  readonly pan: CanvasPoint;
}

export interface CanvasRenderableDrawable {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly partId: PartId;
  readonly partAncestorIds: readonly PartId[];
  readonly textureId: string;
  readonly sourceLayerId?: string;
  readonly binaryAssetId?: string;
  readonly binaryAssetPath?: string;
  readonly bounds: RectDto;
  readonly frontOrder: number;
  readonly visible: boolean;
  readonly opacity: number;
  readonly selected: boolean;
  readonly selectedBySubtree: boolean;
  readonly renderBytes?: Uint8Array;
  readonly renderWidth: number;
  readonly renderHeight: number;
  readonly maskSourceDrawableIds: readonly DrawableId[];
}

export type CanvasRenderableDrawableWithBytes = CanvasRenderableDrawable & {
  readonly renderBytes: Uint8Array;
};

export interface CanvasMaskRelationProjection {
  readonly maskRelationId: string;
  readonly sourceDrawableIds: readonly DrawableId[];
  readonly targetDrawableIds: readonly DrawableId[];
}

export interface CanvasRenderProjection {
  readonly canvasBounds: RectDto;
  readonly artworkBounds?: RectDto;
  readonly selectionBounds?: RectDto;
  readonly selectedDrawableIds: ReadonlySet<DrawableId>;
  readonly selectedPartId?: PartId;
  readonly drawables: readonly CanvasRenderableDrawable[];
  readonly maskRelations: readonly CanvasMaskRelationProjection[];
  readonly hasRenderableArtwork: boolean;
  readonly contentKey: string;
}

export interface CanvasProjectionOptions {
  readonly editorHiddenPartIds?: ReadonlySet<PartId>;
}

const DEFAULT_VIEW: CanvasViewState = {
  zoom: 1,
  pan: { x: 0, y: 0 }
};

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const FIT_PADDING = 48;

export function createCanvasRenderProjection(
  session: AuthoringSession,
  selection: EditorSelection | null,
  options: CanvasProjectionOptions = {}
): CanvasRenderProjection {
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const editorHiddenPartIds = options.editorHiddenPartIds ?? new Set<PartId>();
  const meshesById = new Map(session.graph.meshes.map((mesh) => [mesh.meshId, mesh]));
  const textureEntriesById = new Map(
    session.graph.textureAtlas?.textures.map((texture) => [texture.textureId, texture]) ?? []
  );
  const binaryEntriesByPath = new Map(
    session.binaryAssets?.fileEntries.map((entry) => [entry.path, entry]) ?? []
  );
  const sourceLayerByDrawableId = createSourceLayerIndex(session);
  const frontOrderByDrawableId = new Map(
    session.graph.drawOrder.map((entry) => [entry.drawableId, entry.stableOrder])
  );
  const selectedDrawableIds = resolveSelectedDrawableIds(session, selection, partsById);
  const selectedPartId = selection?.kind === "part" ? selection.id : undefined;
  const maskSourcesByTargetId = createMaskSourceIndex(session);

  const drawables = session.graph.drawables
    .map((drawable): CanvasRenderableDrawable | undefined => {
      const mesh = meshesById.get(drawable.meshId);
      const texture = textureEntriesById.get(drawable.textureId);
      if (mesh === undefined || texture === undefined) {
        return undefined;
      }

      const binaryAssetRef = texture.binaryAssetRef;
      const binaryEntry =
        binaryAssetRef === undefined
          ? undefined
          : binaryEntriesByPath.get(binaryAssetRef.packageRelativePath);
      const sourceLayer = sourceLayerByDrawableId.get(drawable.drawableId);
      const partAncestorIds = collectPartAncestorIds(drawable.partId, partsById);
      const hiddenByPart =
        editorHiddenPartIds.has(drawable.partId) ||
        partAncestorIds.some((partId) => editorHiddenPartIds.has(partId));
      const selected = selection?.kind === "drawable" && selection.id === drawable.drawableId;
      const selectedBySubtree =
        !selected && selection?.kind === "part" && selectedDrawableIds.has(drawable.drawableId);

      return {
        drawableId: drawable.drawableId,
        displayName: drawable.displayName,
        partId: drawable.partId,
        partAncestorIds,
        textureId: drawable.textureId,
        ...(sourceLayer?.sourceLayerId === undefined
          ? {}
          : { sourceLayerId: sourceLayer.sourceLayerId }),
        ...(binaryAssetRef === undefined
          ? {}
          : {
              binaryAssetId: binaryAssetRef.binaryAssetId,
              binaryAssetPath: binaryAssetRef.packageRelativePath
            }),
        bounds: structuredClone(mesh.bounds),
        frontOrder: frontOrderByDrawableId.get(drawable.drawableId) ?? drawable.baseDrawOrder,
        visible: drawable.runtimeVisibility && !hiddenByPart,
        opacity: clamp(drawable.defaultOpacity, 0, 1),
        selected,
        selectedBySubtree,
        ...(binaryEntry === undefined ? {} : { renderBytes: binaryEntry.bytes }),
        renderWidth: Math.round(mesh.bounds.width),
        renderHeight: Math.round(mesh.bounds.height),
        maskSourceDrawableIds: maskSourcesByTargetId.get(drawable.drawableId) ?? []
      };
    })
    .filter(isDefined)
    .sort(compareBackToFront);

  const visibleDrawables = drawables.filter((drawable) => drawable.visible);
  const renderableDrawables = visibleDrawables.filter(isRenderableDrawable);
  const selectedVisibleDrawables = visibleDrawables.filter((drawable) =>
    selectedDrawableIds.has(drawable.drawableId)
  );
  const artworkBounds = unionRects(renderableDrawables.map((drawable) => drawable.bounds));
  const selectionBounds = unionRects(selectedVisibleDrawables.map((drawable) => drawable.bounds));

  return {
    canvasBounds: resolveProjectionCanvasBounds(session),
    ...(artworkBounds === undefined ? {} : { artworkBounds }),
    ...(selectionBounds === undefined ? {} : { selectionBounds }),
    selectedDrawableIds,
    ...(selectedPartId === undefined ? {} : { selectedPartId }),
    drawables,
    maskRelations: session.graph.masks
      .filter((relation) => relation.enabled)
      .map((relation) => ({
        maskRelationId: relation.maskRelationId,
        sourceDrawableIds: [...relation.maskDrawableIds],
        targetDrawableIds: [...relation.targetDrawableIds]
      })),
    hasRenderableArtwork: renderableDrawables.length > 0,
    contentKey: createProjectionContentKey(session, drawables)
  };
}

export function hitTestTopmostDrawable(
  projection: CanvasRenderProjection,
  point: CanvasPoint
): DrawableId | undefined {
  for (let index = projection.drawables.length - 1; index >= 0; index -= 1) {
    const drawable = projection.drawables[index];
    if (drawable === undefined || !drawable.visible || !isRenderableDrawable(drawable)) {
      continue;
    }

    if (pointInRect(point, drawable.bounds)) {
      return drawable.drawableId;
    }
  }

  return undefined;
}

export function fitArtworkView(
  projection: CanvasRenderProjection,
  viewport: CanvasViewportSize
): CanvasViewState {
  return fitRectToViewport(projection.artworkBounds ?? projection.canvasBounds, viewport);
}

export function fitCanvasView(
  projection: CanvasRenderProjection,
  viewport: CanvasViewportSize
): CanvasViewState {
  return fitRectToViewport(projection.canvasBounds, viewport);
}

export function fitRectToViewport(
  rect: RectDto,
  viewport: CanvasViewportSize,
  padding = FIT_PADDING
): CanvasViewState {
  if (viewport.width <= 0 || viewport.height <= 0 || rect.width <= 0 || rect.height <= 0) {
    return DEFAULT_VIEW;
  }

  const paddedWidth = Math.max(1, viewport.width - padding * 2);
  const paddedHeight = Math.max(1, viewport.height - padding * 2);
  const zoom = clamp(Math.min(paddedWidth / rect.width, paddedHeight / rect.height), MIN_ZOOM, MAX_ZOOM);
  const rectCenter = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };

  return {
    zoom,
    pan: {
      x: viewport.width / 2 - rectCenter.x * zoom,
      y: viewport.height / 2 - rectCenter.y * zoom
    }
  };
}

export function screenToCanvasPoint(point: CanvasPoint, view: CanvasViewState): CanvasPoint {
  return {
    x: (point.x - view.pan.x) / view.zoom,
    y: (point.y - view.pan.y) / view.zoom
  };
}

export function canvasToScreenPoint(point: CanvasPoint, view: CanvasViewState): CanvasPoint {
  return {
    x: point.x * view.zoom + view.pan.x,
    y: point.y * view.zoom + view.pan.y
  };
}

export function zoomViewAtScreenPoint(
  view: CanvasViewState,
  screenPoint: CanvasPoint,
  nextZoom: number
): CanvasViewState {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const canvasPoint = screenToCanvasPoint(screenPoint, view);

  return {
    zoom,
    pan: {
      x: screenPoint.x - canvasPoint.x * zoom,
      y: screenPoint.y - canvasPoint.y * zoom
    }
  };
}

export function nudgeZoomAtViewportCenter(
  view: CanvasViewState,
  viewport: CanvasViewportSize,
  factor: number
): CanvasViewState {
  return zoomViewAtScreenPoint(
    view,
    { x: viewport.width / 2, y: viewport.height / 2 },
    view.zoom * factor
  );
}

export function resetOneToOneView(
  projection: CanvasRenderProjection,
  viewport: CanvasViewportSize
): CanvasViewState {
  const rect = projection.artworkBounds ?? projection.canvasBounds;
  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };

  return {
    zoom: 1,
    pan: {
      x: viewport.width / 2 - center.x,
      y: viewport.height / 2 - center.y
    }
  };
}

export function formatZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export function isRenderableDrawable(
  drawable: CanvasRenderableDrawable
): drawable is CanvasRenderableDrawableWithBytes {
  return (
    drawable.renderBytes !== undefined &&
    drawable.renderBytes.byteLength === drawable.renderWidth * drawable.renderHeight * 4 &&
    drawable.renderWidth > 0 &&
    drawable.renderHeight > 0 &&
    drawable.bounds.width > 0 &&
    drawable.bounds.height > 0
  );
}

export function hasIsolatableCanvasSelection(projection: CanvasRenderProjection): boolean {
  return projection.drawables.some(
    (drawable) =>
      (drawable.selected || drawable.selectedBySubtree) &&
      drawable.visible &&
      isRenderableDrawable(drawable)
  );
}

function resolveProjectionCanvasBounds(session: AuthoringSession): RectDto {
  const drawableSourceAssetIds = new Set(session.graph.drawables.map((drawable) => drawable.sourceAssetId));
  const sourceCanvas = session.graph.sourceAssets.find(
    (sourceAsset) => drawableSourceAssetIds.has(sourceAsset.sourceAssetId) && sourceAsset.psdProfile?.canvas !== undefined
  )?.psdProfile?.canvas;
  const bounds = sourceCanvas?.bounds ?? {
    x: 0,
    y: 0,
    width: sourceCanvas?.width ?? session.graph.canvasSize.width,
    height: sourceCanvas?.height ?? session.graph.canvasSize.height
  };

  return structuredClone(bounds);
}

function createSourceLayerIndex(
  session: AuthoringSession
): ReadonlyMap<DrawableId, AuthoringSession["graph"]["sourceAssets"][number]["layers"][number]> {
  const result = new Map<DrawableId, AuthoringSession["graph"]["sourceAssets"][number]["layers"][number]>();

  for (const sourceAsset of session.graph.sourceAssets) {
    for (const layer of sourceAsset.layers) {
      for (const drawableId of layer.mappedDrawableIds) {
        result.set(drawableId, layer);
      }
    }
  }

  return result;
}

function resolveSelectedDrawableIds(
  session: AuthoringSession,
  selection: EditorSelection | null,
  partsById: ReadonlyMap<PartId, AuthoringSession["graph"]["parts"][number]>
): ReadonlySet<DrawableId> {
  if (selection?.kind === "drawable") {
    return new Set([selection.id]);
  }

  if (selection?.kind !== "part") {
    return new Set();
  }

  const result = new Set<DrawableId>();
  const visitPart = (partId: PartId) => {
    const part = partsById.get(partId);
    if (part === undefined) {
      return;
    }

    for (const drawableId of part.drawableIds) {
      result.add(drawableId);
    }

    for (const childPartId of part.childPartIds) {
      visitPart(childPartId);
    }
  };

  visitPart(selection.id);
  return result;
}

function collectPartAncestorIds(
  partId: PartId,
  partsById: ReadonlyMap<PartId, AuthoringSession["graph"]["parts"][number]>
): readonly PartId[] {
  const ancestors: PartId[] = [];
  let current = partsById.get(partId);

  while (current?.parentPartId !== undefined) {
    ancestors.push(current.parentPartId);
    current = partsById.get(current.parentPartId);
  }

  return ancestors;
}

function createMaskSourceIndex(session: AuthoringSession): ReadonlyMap<DrawableId, readonly DrawableId[]> {
  const result = new Map<DrawableId, DrawableId[]>();

  for (const relation of session.graph.masks) {
    if (!relation.enabled) {
      continue;
    }

    for (const targetDrawableId of relation.targetDrawableIds) {
      result.set(targetDrawableId, [
        ...(result.get(targetDrawableId) ?? []),
        ...relation.maskDrawableIds
      ]);
    }
  }

  return result;
}

function compareBackToFront(
  left: CanvasRenderableDrawable,
  right: CanvasRenderableDrawable
): number {
  const frontOrder = right.frontOrder - left.frontOrder;
  if (frontOrder !== 0) {
    return frontOrder;
  }

  return left.drawableId.localeCompare(right.drawableId);
}

function unionRects(rects: readonly RectDto[]): RectDto | undefined {
  const positive = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  if (positive.length === 0) {
    return undefined;
  }

  const left = Math.min(...positive.map((rect) => rect.x));
  const top = Math.min(...positive.map((rect) => rect.y));
  const right = Math.max(...positive.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...positive.map((rect) => rect.y + rect.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
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

function createProjectionContentKey(
  session: AuthoringSession,
  drawables: readonly CanvasRenderableDrawable[]
): string {
  return [
    session.packageRevision,
    drawables.length,
    ...drawables.map((drawable) =>
      [
        drawable.drawableId,
        drawable.visible ? "v" : "h",
        drawable.opacity.toFixed(4),
        drawable.bounds.x,
        drawable.bounds.y,
        drawable.bounds.width,
        drawable.bounds.height,
        drawable.binaryAssetId ?? "missing"
      ].join(":")
    )
  ].join("|");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isDefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}
