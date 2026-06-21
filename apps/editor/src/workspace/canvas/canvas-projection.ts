import {
  getPartOrderedChildren,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId, RectDto, RigControlId } from "@private-2d-rigging-lab/contracts";
import {
  recordLive2dPerformanceTiming,
  startLive2dPerformanceTiming
} from "@private-2d-rigging-lab/render-core";

import type { EditorSelection } from "../../features/editor-session/model/editor-selection";
import {
  getSingleSelectedDrawableId,
  isDrawableSelected
} from "../../features/editor-session/model/editor-selection";
import type { ParameterValueMap } from "../../features/editor-session/model/parameter-keyform-state";
import {
  createCanvasEvaluatedScene,
  type CanvasEvaluatedDrawable,
  type CanvasEvaluatedMesh,
  type CanvasEvaluatedRigControl,
  type CanvasEvaluationControlPointPreview,
  type CanvasEvaluationRotationPreview,
  type CanvasEvaluationRigDraft
} from "./canvas-evaluation";

type MeshDto = AuthoringSession["graph"]["meshes"][number];
type RigControlDto = AuthoringSession["graph"]["rigControls"][number];

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
  readonly evaluatedMesh: CanvasEvaluatedMesh;
  readonly frontOrder: number;
  readonly visible: boolean;
  readonly opacity: number;
  readonly selected: boolean;
  readonly selectedBySubtree: boolean;
  readonly meshPreview: boolean;
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

export interface CanvasMeshOverlayProjection {
  readonly drawableId: DrawableId;
  readonly mesh: CanvasEvaluatedMesh;
  readonly status: "draft" | "committed";
}

export interface CanvasDeformerOverlayProjection {
  readonly kind: "warp" | "rotation";
  readonly rigControlId?: RigControlId;
  readonly displayName: string;
  readonly domainBounds: RectDto;
  readonly transformColumns: number;
  readonly transformRows: number;
  readonly bezierColumns: number;
  readonly bezierRows: number;
  readonly pivot?: CanvasPoint;
  readonly translation?: CanvasPoint;
  readonly restAngleDegrees?: number;
  readonly evaluatedAngleDegrees?: number;
  readonly restControlPoints?: readonly CanvasPoint[];
  readonly controlPointOffsets?: readonly CanvasPoint[];
  readonly evaluatedControlPoints?: readonly CanvasPoint[];
  readonly childDrawableIds: readonly DrawableId[];
  readonly childRigControlIds: readonly RigControlId[];
  readonly status: "draft" | "committed";
}

export interface CanvasRenderProjection {
  readonly canvasBounds: RectDto;
  readonly artworkBounds?: RectDto;
  readonly selectionBounds?: RectDto;
  readonly selectedDrawableIds: ReadonlySet<DrawableId>;
  readonly selectedPartId?: PartId;
  readonly drawables: readonly CanvasRenderableDrawable[];
  readonly maskRelations: readonly CanvasMaskRelationProjection[];
  readonly meshOverlay?: CanvasMeshOverlayProjection;
  readonly meshOverlays?: readonly CanvasMeshOverlayProjection[];
  readonly deformerOverlay?: CanvasDeformerOverlayProjection;
  readonly hasRenderableArtwork: boolean;
  readonly contentKey: string;
}

export interface CanvasProjectionOptions {
  readonly editorHiddenPartIds?: ReadonlySet<PartId>;
  readonly meshDraft?: {
    readonly drawableId: DrawableId;
    readonly mesh: MeshDto;
    readonly meshDrafts?: readonly {
      readonly drawableId: DrawableId;
      readonly mesh: MeshDto;
    }[];
  } | null;
  readonly meshDrafts?: readonly {
    readonly drawableId: DrawableId;
    readonly mesh: MeshDto;
  }[] | null;
  readonly deformerDraft?: {
    readonly displayName: string;
    readonly parentRigControlId?: RigControlId | undefined;
    readonly domainBounds: RectDto;
    readonly transformColumns: number;
    readonly transformRows: number;
    readonly bezierColumns: number;
    readonly bezierRows: number;
    readonly childDrawableIds: readonly DrawableId[];
    readonly childRigControlIds: readonly RigControlId[];
    readonly opacityMultiplier?: number | undefined;
  } | null;
  readonly meshPreviewDrawableId?: DrawableId;
  readonly meshPreviewDrawableIds?: readonly DrawableId[];
  readonly controlPointPreview?: CanvasEvaluationControlPointPreview | null;
  readonly rotationPreview?: CanvasEvaluationRotationPreview | null;
  readonly parameterValues?: ParameterValueMap;
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
  const timingStart = startLive2dPerformanceTiming();
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const meshesById = new Map(session.graph.meshes.map((mesh) => [mesh.meshId, mesh]));
  const rigControlsById = new Map(
    session.graph.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );
  const binaryEntriesByPath = new Map(
    session.binaryAssets?.fileEntries.map((entry) => [entry.path, entry]) ?? []
  );
  const sourceLayerByDrawableId = createSourceLayerIndex(session);
  const selectedDrawableIds = resolveSelectedDrawableIds(
    session,
    selection,
    partsById,
    rigControlsById
  );
  const selectedPartId = selection?.kind === "part" ? selection.id : undefined;
  const selectedDrawableId = getSingleSelectedDrawableId(selection);
  const meshPreviewDrawableIds = new Set([
    ...(options.meshPreviewDrawableIds ?? []),
    ...(options.meshPreviewDrawableId === undefined ? [] : [options.meshPreviewDrawableId])
  ]);
  const evaluatedScene = createCanvasEvaluatedScene(session, {
    meshDraft: options.meshDraft ?? null,
    meshDrafts: options.meshDrafts ?? null,
    rigDraft: createEvaluationRigDraftFromProjectionDraft(options.deformerDraft ?? null),
    controlPointPreview: options.controlPointPreview ?? null,
    rotationPreview: options.rotationPreview ?? null,
    parameterValues: options.parameterValues ?? {},
    selection,
    ...(options.editorHiddenPartIds === undefined
      ? {}
      : { editorHiddenPartIds: options.editorHiddenPartIds })
  });

  const drawables = evaluatedScene.drawables
    .map((drawable): CanvasRenderableDrawable | undefined => {
      const binaryEntry =
        drawable.textureRef.binaryAssetPath === undefined
          ? undefined
          : binaryEntriesByPath.get(drawable.textureRef.binaryAssetPath);
      const sourceLayer = sourceLayerByDrawableId.get(drawable.drawableId);
      const baseMesh =
        drawable.evaluatedMesh.sourceMeshId === undefined
          ? undefined
          : meshesById.get(drawable.evaluatedMesh.sourceMeshId as MeshDto["meshId"]);
      const renderDimensions = resolveDrawableRenderDimensions({
        drawable,
        ...(baseMesh === undefined ? {} : { baseMesh }),
        ...(sourceLayer === undefined ? {} : { sourceLayer })
      });
      const selected = isDrawableSelected(selection, drawable.drawableId);
      const selectedBySubtree = !selected && selectedDrawableIds.has(drawable.drawableId);
      const meshPreview = meshPreviewDrawableIds.has(drawable.drawableId);

      return {
        drawableId: drawable.drawableId,
        displayName: drawable.displayName,
        partId: drawable.partId,
        partAncestorIds: drawable.partAncestorIds,
        textureId: drawable.textureRef.textureId,
        ...(drawable.textureRef.sourceLayerId === undefined
          ? {}
          : { sourceLayerId: drawable.textureRef.sourceLayerId }),
        ...(drawable.textureRef.binaryAssetId === undefined
          ? {}
          : { binaryAssetId: drawable.textureRef.binaryAssetId }),
        ...(drawable.textureRef.binaryAssetPath === undefined
          ? {}
          : { binaryAssetPath: drawable.textureRef.binaryAssetPath }),
        bounds: structuredClone(drawable.bounds),
        evaluatedMesh: cloneEvaluatedMesh(drawable.evaluatedMesh),
        frontOrder: drawable.drawOrder,
        visible: meshPreview || drawable.visible,
        opacity: drawable.opacity,
        selected,
        selectedBySubtree,
        meshPreview,
        ...(binaryEntry === undefined ? {} : { renderBytes: binaryEntry.bytes }),
        renderWidth: renderDimensions.width,
        renderHeight: renderDimensions.height,
        maskSourceDrawableIds: drawable.maskSourceDrawableIds
      };
    })
    .filter(isDefined);

  const visibleDrawables = drawables.filter((drawable) => drawable.visible);
  const renderableDrawables = visibleDrawables.filter(isRenderableDrawable);
  const selectedVisibleDrawables = visibleDrawables.filter((drawable) =>
    selectedDrawableIds.has(drawable.drawableId)
  );
  const artworkBounds = unionRects(renderableDrawables.map((drawable) => drawable.bounds));
  const selectionBounds = unionRects(selectedVisibleDrawables.map((drawable) => drawable.bounds));
  const meshDraftsByDrawableId = createProjectionMeshDraftIndex(options);
  const meshOverlayDrawableIds = selectedDrawableId === undefined
    ? [...meshDraftsByDrawableId.keys()].filter((drawableId) => selectedDrawableIds.has(drawableId))
    : [selectedDrawableId];
  const meshOverlays = resolveSelectedMeshOverlays({
    selectedDrawableIds: meshOverlayDrawableIds,
    evaluatedScene,
    drafts: meshDraftsByDrawableId
  });
  const meshOverlay =
    selectedDrawableId === undefined
      ? meshOverlays[0]
      : meshOverlays.find((overlay) => overlay.drawableId === selectedDrawableId);
  const deformerOverlay = resolveDeformerOverlay({
    selection,
    ...(selectionBounds === undefined ? {} : { selectionBounds }),
    evaluatedRigControls: evaluatedScene.rigControls,
    draft: options.deformerDraft ?? null
  });

  const projection = {
    canvasBounds: evaluatedScene.canvasBounds,
    ...(artworkBounds === undefined ? {} : { artworkBounds }),
    ...(selectionBounds === undefined ? {} : { selectionBounds }),
    selectedDrawableIds,
    ...(selectedPartId === undefined ? {} : { selectedPartId }),
    drawables,
    maskRelations: evaluatedScene.maskRelations.map((relation) => ({
      maskRelationId: relation.maskRelationId,
      sourceDrawableIds: relation.sourceDrawableIds,
      targetDrawableIds: relation.targetDrawableIds
    })),
    meshOverlays,
    ...(meshOverlay === undefined ? {} : { meshOverlay }),
    ...(deformerOverlay === undefined ? {} : { deformerOverlay }),
    hasRenderableArtwork: renderableDrawables.length > 0,
    contentKey: createProjectionContentKey(session, drawables)
  };
  recordLive2dPerformanceTiming("canvas.projection.ms", timingStart);
  return projection;
}

function createEvaluationRigDraftFromProjectionDraft(
  draft: CanvasProjectionOptions["deformerDraft"]
): CanvasEvaluationRigDraft | null {
  if (draft === null || draft === undefined) {
    return null;
  }

  return {
    kind: "warp",
    displayName: draft.displayName,
    ...(draft.parentRigControlId === undefined
      ? {}
      : { parentRigControlId: draft.parentRigControlId }),
    childDrawableIds: [...draft.childDrawableIds],
    childRigControlIds: [...draft.childRigControlIds],
    domainBounds: structuredClone(draft.domainBounds),
    transformColumns: draft.transformColumns,
    transformRows: draft.transformRows,
    bezierColumns: draft.bezierColumns,
    bezierRows: draft.bezierRows,
    ...(draft.opacityMultiplier === undefined
      ? {}
      : { opacityMultiplier: draft.opacityMultiplier })
  };
}

function createProjectionMeshDraftIndex(
  options: CanvasProjectionOptions
): ReadonlyMap<DrawableId, NonNullable<CanvasProjectionOptions["meshDraft"]>> {
  const drafts =
    options.meshDrafts ??
    options.meshDraft?.meshDrafts ??
    (options.meshDraft === undefined || options.meshDraft === null ? [] : [options.meshDraft]);

  return new Map(drafts.map((draft) => [draft.drawableId, draft]));
}

function resolveDrawableRenderDimensions(input: {
  readonly drawable: CanvasEvaluatedDrawable;
  readonly sourceLayer?: AuthoringSession["graph"]["sourceAssets"][number]["layers"][number];
  readonly baseMesh?: MeshDto;
}): { readonly width: number; readonly height: number } {
  const bounds =
    input.sourceLayer?.bounds ??
    input.baseMesh?.bounds ??
    input.drawable.evaluatedMesh.bounds ??
    input.drawable.bounds;

  return {
    width: Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height))
  };
}

function cloneEvaluatedMesh(mesh: CanvasEvaluatedMesh): CanvasEvaluatedMesh {
  return {
    source: mesh.source,
    ...(mesh.sourceMeshId === undefined ? {} : { sourceMeshId: mesh.sourceMeshId }),
    vertices: mesh.vertices.map(clonePoint),
    uvs: mesh.uvs.map(clonePoint),
    triangles: mesh.triangles.map(
      (triangle): readonly [number, number, number] => [triangle[0], triangle[1], triangle[2]]
    ),
    bounds: structuredClone(mesh.bounds),
    ...(mesh.vertexStableIds === undefined ? {} : { vertexStableIds: [...mesh.vertexStableIds] })
  };
}

function clonePoint(point: CanvasPoint): CanvasPoint {
  return {
    x: point.x,
    y: point.y
  };
}

function resolveDeformerOverlay(input: {
  readonly selection: EditorSelection | null;
  readonly selectionBounds?: RectDto;
  readonly evaluatedRigControls: readonly CanvasEvaluatedRigControl[];
  readonly draft: CanvasProjectionOptions["deformerDraft"];
}): CanvasDeformerOverlayProjection | undefined {
  if (input.draft !== null && input.draft !== undefined) {
    const evaluatedDraft = input.evaluatedRigControls.find(
      (rigControl) => rigControl.status === "draft"
    );
    return evaluatedDraft === undefined
      ? undefined
      : createDeformerOverlayProjection(evaluatedDraft, input.selectionBounds);
  }

  if (input.selection?.kind !== "rigControl") {
    return undefined;
  }

  const selectedRigControlId = input.selection.id;
  const evaluatedRigControl = input.evaluatedRigControls.find(
    (rigControl) => rigControl.rigControlId === selectedRigControlId
  );
  return evaluatedRigControl === undefined
    ? undefined
    : createDeformerOverlayProjection(evaluatedRigControl, input.selectionBounds);
}

function resolveSelectedMeshOverlays(input: {
  readonly selectedDrawableIds: readonly DrawableId[];
  readonly evaluatedScene: ReturnType<typeof createCanvasEvaluatedScene>;
  readonly drafts: ReadonlyMap<DrawableId, NonNullable<CanvasProjectionOptions["meshDraft"]>>;
}): readonly CanvasMeshOverlayProjection[] {
  return input.selectedDrawableIds
    .map((selectedDrawableId): CanvasMeshOverlayProjection | undefined => {
      const drawable = input.evaluatedScene.drawables.find(
        (candidate) => candidate.drawableId === selectedDrawableId
      );
      const mesh = drawable?.evaluatedMesh;
      if (
        mesh === undefined ||
        mesh.source === "rectFallback" ||
        mesh.vertices.length === 0 ||
        mesh.triangles.length === 0
      ) {
        return undefined;
      }

      return {
        drawableId: selectedDrawableId,
        mesh: cloneEvaluatedMesh(mesh),
        status: mesh.source === "draft" || input.drafts.has(selectedDrawableId)
          ? "draft"
          : "committed"
      };
    })
    .filter(isDefined);
}

function createDeformerOverlayProjection(
  rigControl: CanvasEvaluatedRigControl,
  selectionBounds: RectDto | undefined
): CanvasDeformerOverlayProjection {
  if (rigControl.kind === "rotation") {
    return {
      kind: "rotation",
      ...(rigControl.rigControlId === undefined ? {} : { rigControlId: rigControl.rigControlId }),
      displayName: rigControl.displayName,
      domainBounds: selectionBounds ?? structuredClone(rigControl.domainBounds),
      transformColumns: 0,
      transformRows: 0,
      bezierColumns: 0,
      bezierRows: 0,
      pivot: structuredClone(rigControl.pivot),
      translation: structuredClone(rigControl.translation),
      restAngleDegrees: rigControl.restAngleDegrees,
      evaluatedAngleDegrees: rigControl.evaluatedAngleDegrees,
      childDrawableIds: [...rigControl.childDrawableIds],
      childRigControlIds: [...rigControl.childRigControlIds],
      status: rigControl.status
    };
  }

  return {
    kind: "warp",
    ...(rigControl.rigControlId === undefined ? {} : { rigControlId: rigControl.rigControlId }),
    displayName: rigControl.displayName,
    domainBounds: structuredClone(rigControl.domainBounds),
    transformColumns: rigControl.transformColumns,
    transformRows: rigControl.transformRows,
    bezierColumns: rigControl.bezierColumns,
    bezierRows: rigControl.bezierRows,
    restControlPoints: rigControl.restControlPoints.map(clonePoint),
    controlPointOffsets: rigControl.controlPointOffsets.map(clonePoint),
    evaluatedControlPoints: rigControl.evaluatedControlPoints.map(clonePoint),
    childDrawableIds: [...rigControl.childDrawableIds],
    childRigControlIds: [...rigControl.childRigControlIds],
    status: rigControl.status
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
  partsById: ReadonlyMap<PartId, AuthoringSession["graph"]["parts"][number]>,
  rigControlsById: ReadonlyMap<RigControlId, RigControlDto>
): ReadonlySet<DrawableId> {
  if (selection?.kind === "drawable") {
    return new Set([selection.id]);
  }

  if (selection?.kind === "drawableSet") {
    return new Set(selection.ids);
  }

  if (selection?.kind === "rigControl") {
    return collectRigControlDrawableIds(selection.id, rigControlsById);
  }

  if (selection?.kind === "deformerTreeSet") {
    const result = new Set<DrawableId>();
    for (const target of selection.targets) {
      if (target.kind === "rigControl") {
        for (const drawableId of collectRigControlDrawableIds(
          target.rigControlId,
          rigControlsById
        )) {
          result.add(drawableId);
        }
        continue;
      }

      result.add(target.drawableId);
    }

    return result;
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

    for (const child of getPartOrderedChildren(session.graph, part)) {
      if (child.kind === "drawable") {
        result.add(child.drawableId);
        continue;
      }

      visitPart(child.partId);
    }
  };

  visitPart(selection.id);
  return result;
}

function collectRigControlDrawableIds(
  rigControlId: RigControlId,
  rigControlsById: ReadonlyMap<RigControlId, RigControlDto>
): ReadonlySet<DrawableId> {
  const result = new Set<DrawableId>();
  const visited = new Set<string>();
  const visitRigControl = (currentRigControlId: RigControlId) => {
    const rigControl = rigControlsById.get(currentRigControlId);
    if (rigControl === undefined || visited.has(currentRigControlId)) {
      return;
    }

    visited.add(currentRigControlId);
    for (const drawableId of rigControl.childDrawableIds) {
      result.add(drawableId);
    }

    for (const childRigControlId of rigControl.childRigControlIds) {
      visitRigControl(childRigControlId);
    }
  };

  visitRigControl(rigControlId);
  return result;
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
        drawable.binaryAssetId ?? "missing",
        drawable.renderBytes?.byteLength ?? 0,
        `${drawable.renderWidth}x${drawable.renderHeight}`
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
