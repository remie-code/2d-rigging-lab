import {
  createStructureDrawOrderIndex,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DrawableId,
  PartId,
  RectDto,
  RigControlId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import {
  recordLive2dPerformanceTiming,
  startLive2dPerformanceTiming
} from "@private-2d-rigging-lab/render-core";

import type { EditorSelection } from "../../features/editor-session/model/editor-selection";
import {
  createEvaluatedParameterKeyformState,
  type ParameterValueMap
} from "../../features/editor-session/model/parameter-keyform-state";

type MeshDto = AuthoringSession["graph"]["meshes"][number];
type RigControlDto = AuthoringSession["graph"]["rigControls"][number];
type RotationRigControlDto = Extract<RigControlDto, { readonly kind: "rotation2d" }>;
type WarpLatticeRigControlDto = Extract<RigControlDto, { readonly kind: "warpLattice2d" }>;
type EvaluationRigControlId = string;

export interface CanvasEvaluatedScene {
  readonly canvasBounds: RectDto;
  readonly artworkBounds?: RectDto;
  readonly drawables: readonly CanvasEvaluatedDrawable[];
  readonly rigControls: readonly CanvasEvaluatedRigControl[];
  readonly maskRelations: readonly CanvasEvaluatedMaskRelation[];
}

export interface CanvasEvaluatedDrawable {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly partId: PartId;
  readonly partAncestorIds: readonly PartId[];
  readonly textureRef: CanvasEvaluatedTextureRef;
  readonly evaluatedMesh: CanvasEvaluatedMesh;
  readonly bounds: RectDto;
  readonly opacity: number;
  readonly visible: boolean;
  readonly drawOrder: number;
  readonly maskSourceDrawableIds: readonly DrawableId[];
  readonly rigControlChainIds: readonly RigControlId[];
}

export interface CanvasEvaluatedTextureRef {
  readonly textureId: string;
  readonly sourceLayerId?: string;
  readonly binaryAssetId?: string;
  readonly binaryAssetPath?: string;
}

export interface CanvasEvaluatedMesh {
  readonly source: "committed" | "draft" | "rectFallback";
  readonly sourceMeshId?: string;
  readonly vertices: readonly Vec2Dto[];
  readonly uvs: readonly Vec2Dto[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly bounds: RectDto;
  readonly vertexStableIds?: readonly string[];
}

export interface CanvasEvaluatedMaskRelation {
  readonly maskRelationId: string;
  readonly sourceDrawableIds: readonly DrawableId[];
  readonly targetDrawableIds: readonly DrawableId[];
}

export type CanvasEvaluatedRigControl =
  | CanvasEvaluatedWarpRigControl
  | CanvasEvaluatedRotationRigControl;

export interface CanvasEvaluatedRigControlBase {
  readonly status: "committed" | "draft";
  readonly rigControlId?: RigControlId;
  readonly displayName: string;
  readonly domainBounds: RectDto;
  readonly childDrawableIds: readonly DrawableId[];
  readonly childRigControlIds: readonly RigControlId[];
}

export interface CanvasEvaluatedWarpRigControl extends CanvasEvaluatedRigControlBase {
  readonly kind: "warp";
  readonly transformColumns: number;
  readonly transformRows: number;
  readonly bezierColumns: number;
  readonly bezierRows: number;
  readonly restControlPoints: readonly Vec2Dto[];
  readonly controlPointOffsets: readonly Vec2Dto[];
  readonly evaluatedControlPoints: readonly Vec2Dto[];
}

export interface CanvasEvaluatedRotationRigControl extends CanvasEvaluatedRigControlBase {
  readonly kind: "rotation";
  readonly pivot: Vec2Dto;
  readonly translation: Vec2Dto;
  readonly restAngleDegrees: number;
  readonly evaluatedAngleDegrees: number;
}

export interface CanvasEvaluationOptions {
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
  readonly rigDraft?: CanvasEvaluationRigDraft | null;
  readonly controlPointPreview?: CanvasEvaluationControlPointPreview | null;
  readonly rotationPreview?: CanvasEvaluationRotationPreview | null;
  readonly parameterValues?: ParameterValueMap;
  readonly selection?: EditorSelection | null;
  readonly overlayToggles?: Readonly<Record<string, boolean>>;
}

export type CanvasEvaluationRigDraft =
  | {
      readonly kind: "warp";
      readonly displayName?: string;
      readonly parentRigControlId?: RigControlId;
      readonly childDrawableIds: readonly DrawableId[];
      readonly childRigControlIds: readonly RigControlId[];
      readonly domainBounds: RectDto;
      readonly transformColumns: number;
      readonly transformRows: number;
      readonly bezierColumns?: number;
      readonly bezierRows?: number;
      readonly controlPointOffsets?: readonly Vec2Dto[];
      readonly opacityMultiplier?: number;
    }
  | {
      readonly kind: "rotation";
      readonly displayName?: string;
      readonly parentRigControlId?: RigControlId;
      readonly childDrawableIds: readonly DrawableId[];
      readonly childRigControlIds: readonly RigControlId[];
      readonly pivot: Vec2Dto;
      readonly angleDegrees: number;
      readonly opacityMultiplier?: number;
    };

export interface CanvasEvaluationControlPointPreview {
  readonly rigControlId: RigControlId;
  readonly controlPointOffsets: readonly Vec2Dto[];
  readonly compositionMode?: "replaceEvaluated" | "additiveDelta";
}

export interface CanvasEvaluationRotationPreview {
  readonly rigControlId: RigControlId;
  readonly pivot?: Vec2Dto;
  readonly translation?: Vec2Dto;
  readonly restAngleDegrees?: number;
  readonly evaluatedAngleDegrees?: number;
}

interface EvaluationRigControlBase {
  readonly id: EvaluationRigControlId;
  readonly sourceRigControlId?: RigControlId;
  readonly source: "committed" | "draft";
  readonly displayName: string;
  readonly parentId?: EvaluationRigControlId;
  readonly childDrawableIds: readonly DrawableId[];
  readonly childRigControlIds: readonly EvaluationRigControlId[];
  readonly enabled: boolean;
  readonly opacityMultiplier: number;
  readonly orderIndex: number;
}

interface EvaluationWarpRigControl extends EvaluationRigControlBase {
  readonly kind: "warp";
  readonly domainBounds: RectDto;
  readonly latticeColumns: number;
  readonly latticeRows: number;
  readonly bezierColumns: number;
  readonly bezierRows: number;
  readonly controlPointOffsets: readonly Vec2Dto[];
}

interface EvaluationRotationRigControl extends EvaluationRigControlBase {
  readonly kind: "rotation";
  readonly pivot: Vec2Dto;
  readonly restAngleDegrees: number;
  readonly angleDegrees: number;
  readonly translation: Vec2Dto;
  readonly scale: Vec2Dto;
}

type EvaluationRigControl = EvaluationWarpRigControl | EvaluationRotationRigControl;

const DRAFT_RIG_CONTROL_ID = "canvasDraftRigControl";

export function createCanvasEvaluatedScene(
  session: AuthoringSession,
  options: CanvasEvaluationOptions = {}
): CanvasEvaluatedScene {
  const timingStart = startLive2dPerformanceTiming();
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const meshesById = new Map(session.graph.meshes.map((mesh) => [mesh.meshId, mesh]));
  const textureEntriesById = new Map(
    session.graph.textureAtlas?.textures.map((texture) => [texture.textureId, texture]) ?? []
  );
  const binaryEntriesByPath = new Map(
    session.binaryAssets?.fileEntries.map((entry) => [entry.path, entry]) ?? []
  );
  const sourceLayerByDrawableId = createSourceLayerIndex(session);
  const editorHiddenPartIds = options.editorHiddenPartIds ?? new Set<PartId>();
  const frontOrderByDrawableId = createStructureDrawOrderIndex(session.graph);
  const evaluatedKeyforms = createEvaluatedParameterKeyformState(
    session,
    options.parameterValues ?? {}
  );
  const rigControls = createEvaluationRigControls({
    evaluatedKeyforms,
    preview: options.controlPointPreview ?? null,
    rotationPreview: options.rotationPreview ?? null,
    rigDraft: options.rigDraft ?? null,
    session
  });
  const rigControlsById = new Map(rigControls.map((rigControl) => [rigControl.id, rigControl]));
  const rigControlOrder = createRigControlEvaluationOrder(rigControls);
  const directRigControlByDrawableId = createDirectRigControlByDrawableId(
    rigControlOrder,
    rigControlsById
  );
  const maskSourcesByTargetId = createMaskSourceIndex(session);
  const meshDraftsByDrawableId = createMeshDraftIndex(options);

  const drawables = session.graph.drawables
    .map((drawable): CanvasEvaluatedDrawable | undefined => {
      const texture = textureEntriesById.get(drawable.textureId);
      if (texture === undefined) {
        return undefined;
      }

      const sourceLayer = sourceLayerByDrawableId.get(drawable.drawableId);
      const baseMesh = createBaseEvaluatedMesh({
        drawableId: drawable.drawableId,
        fallbackBounds:
          sourceLayer?.bounds ?? {
            x: 0,
            y: 0,
            width: Math.max(1, session.graph.canvasSize.width),
            height: Math.max(1, session.graph.canvasSize.height)
          },
        mesh: meshesById.get(drawable.meshId),
        meshDraft: meshDraftsByDrawableId.get(drawable.drawableId) ?? null
      });
      const chain = createDrawableRigControlChain(
        directRigControlByDrawableId.get(drawable.drawableId),
        rigControlsById
      );
      const vertices = applyRigControlChainToVertices({
        chain,
        currentVertices: baseMesh.vertices,
        referenceVertices: baseMesh.vertices
      });
      const bounds = computeEvaluatedMeshBounds(baseMesh, vertices);
      const partAncestorIds = collectPartAncestorIds(drawable.partId, partsById);
      const hiddenByPart =
        editorHiddenPartIds.has(drawable.partId) ||
        partAncestorIds.some((partId) => editorHiddenPartIds.has(partId));
      const binaryAssetRef = texture.binaryAssetRef;
      const binaryEntry =
        binaryAssetRef === undefined
          ? undefined
          : binaryEntriesByPath.get(binaryAssetRef.packageRelativePath);
      const mesh = {
        ...baseMesh,
        vertices,
        bounds
      };

      return {
        drawableId: drawable.drawableId,
        displayName: drawable.displayName,
        partId: drawable.partId,
        partAncestorIds,
        textureRef: {
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
          ...(binaryEntry === undefined || binaryAssetRef !== undefined
            ? {}
            : {
                binaryAssetId: binaryEntry.binaryAssetId,
                binaryAssetPath: binaryEntry.path
              })
        },
        evaluatedMesh: mesh,
        bounds,
        opacity: evaluateDrawableOpacity({
          baseOpacity:
            evaluatedKeyforms.drawableOpacityById.get(drawable.drawableId) ??
            drawable.defaultOpacity,
          chain
        }),
        visible: drawable.runtimeVisibility && !hiddenByPart,
        drawOrder: frontOrderByDrawableId.get(drawable.drawableId) ?? drawable.baseDrawOrder,
        maskSourceDrawableIds: maskSourcesByTargetId.get(drawable.drawableId) ?? [],
        rigControlChainIds: chain
          .map((rigControl) => rigControl.sourceRigControlId)
          .filter((rigControlId): rigControlId is RigControlId => rigControlId !== undefined)
      };
    })
    .filter(isDefined)
    .sort(compareBackToFront);
  const artworkBounds = unionRects(
    drawables
      .filter((drawable) => drawable.visible)
      .map((drawable) => drawable.bounds)
  );

  const scene = {
    canvasBounds: resolveEvaluationCanvasBounds(session),
    ...(artworkBounds === undefined ? {} : { artworkBounds }),
    drawables,
    rigControls: createCanvasEvaluatedRigControls(rigControls, rigControlsById),
    maskRelations: session.graph.masks
      .filter((relation) => relation.enabled)
      .map((relation) => ({
        maskRelationId: relation.maskRelationId,
        sourceDrawableIds: [...relation.maskDrawableIds],
        targetDrawableIds: [...relation.targetDrawableIds]
      }))
  };
  recordLive2dPerformanceTiming("canvas.evaluation.ms", timingStart);
  return scene;
}

function createEvaluationRigControls(input: {
  readonly session: AuthoringSession;
  readonly evaluatedKeyforms: ReturnType<typeof createEvaluatedParameterKeyformState>;
  readonly preview: CanvasEvaluationControlPointPreview | null;
  readonly rotationPreview: CanvasEvaluationRotationPreview | null;
  readonly rigDraft: CanvasEvaluationRigDraft | null;
}): readonly EvaluationRigControl[] {
  const committed = input.session.graph.rigControls
    .map((rigControl, orderIndex): EvaluationRigControl | undefined => {
      if (isWarpLatticeRigControl(rigControl)) {
        return createEvaluationWarpRigControl({
          evaluatedKeyforms: input.evaluatedKeyforms,
          orderIndex,
          preview: input.preview,
          rigControl
        });
      }

      if (isRotationRigControl(rigControl)) {
        return createEvaluationRotationRigControl({
          evaluatedKeyforms: input.evaluatedKeyforms,
          orderIndex,
          preview: input.rotationPreview,
          rigControl
        });
      }

      return undefined;
    })
    .filter(isDefined);
  const draft =
    input.rigDraft === null
      ? undefined
      : createEvaluationRigDraft(input.rigDraft, committed.length);

  return draft === undefined ? committed : [...committed, draft];
}

function createEvaluationWarpRigControl(input: {
  readonly rigControl: WarpLatticeRigControlDto;
  readonly evaluatedKeyforms: ReturnType<typeof createEvaluatedParameterKeyformState>;
  readonly preview: CanvasEvaluationControlPointPreview | null;
  readonly orderIndex: number;
}): EvaluationWarpRigControl {
  const latticeColumns =
    input.rigControl.warpDeformer?.transformGrid.columns ?? input.rigControl.latticeColumns;
  const latticeRows =
    input.rigControl.warpDeformer?.transformGrid.rows ?? input.rigControl.latticeRows;
  const expectedCount = Math.max(0, latticeColumns * latticeRows);
  const evaluatedOffsets = normalizeControlPointOffsets(
    input.evaluatedKeyforms.rigControlPointOffsetsById.get(input.rigControl.rigControlId),
    expectedCount
  );
  const controlPointOffsets =
    input.preview?.rigControlId === input.rigControl.rigControlId
      ? composeControlPointPreview(evaluatedOffsets, input.preview, expectedCount)
      : evaluatedOffsets;

  return {
    id: input.rigControl.rigControlId,
    sourceRigControlId: input.rigControl.rigControlId,
    source: "committed",
    displayName: input.rigControl.displayName,
    ...(input.rigControl.parentId === undefined
      ? {}
      : { parentId: input.rigControl.parentId }),
    childDrawableIds: [...input.rigControl.childDrawableIds],
    childRigControlIds: [...input.rigControl.childRigControlIds],
    enabled: input.rigControl.enabled,
    opacityMultiplier: clamp01(
      input.evaluatedKeyforms.rigOpacityMultiplierById.get(input.rigControl.rigControlId) ??
        input.rigControl.opacityMultiplier ??
        1
    ),
    orderIndex: input.orderIndex,
    kind: "warp",
    domainBounds: structuredClone(input.rigControl.domainBounds),
    latticeColumns,
    latticeRows,
    bezierColumns:
      input.rigControl.warpDeformer?.bezierEditSurface.columns ?? input.rigControl.latticeColumns,
    bezierRows:
      input.rigControl.warpDeformer?.bezierEditSurface.rows ?? input.rigControl.latticeRows,
    controlPointOffsets
  };
}

function createEvaluationRotationRigControl(input: {
  readonly rigControl: RotationRigControlDto;
  readonly evaluatedKeyforms: ReturnType<typeof createEvaluatedParameterKeyformState>;
  readonly preview: CanvasEvaluationRotationPreview | null;
  readonly orderIndex: number;
}): EvaluationRotationRigControl {
  const preview =
    input.preview?.rigControlId === input.rigControl.rigControlId ? input.preview : null;
  const restAngleDegrees = preview?.restAngleDegrees ?? input.rigControl.restAngleDegrees;
  const evaluatedAngleDegrees =
    preview?.evaluatedAngleDegrees ??
    input.evaluatedKeyforms.rigAngleDegreesById.get(input.rigControl.rigControlId) ??
    restAngleDegrees;
  const translation =
    preview?.translation ??
    input.evaluatedKeyforms.rigTranslationById.get(input.rigControl.rigControlId) ??
    input.rigControl.restTranslation ??
    { x: 0, y: 0 };

  return {
    id: input.rigControl.rigControlId,
    sourceRigControlId: input.rigControl.rigControlId,
    source: "committed",
    displayName: input.rigControl.displayName,
    ...(input.rigControl.parentId === undefined
      ? {}
      : { parentId: input.rigControl.parentId }),
    childDrawableIds: [...input.rigControl.childDrawableIds],
    childRigControlIds: [...input.rigControl.childRigControlIds],
    enabled: input.rigControl.enabled,
    opacityMultiplier: clamp01(
      input.evaluatedKeyforms.rigOpacityMultiplierById.get(input.rigControl.rigControlId) ??
        input.rigControl.opacityMultiplier ??
        1
    ),
    orderIndex: input.orderIndex,
    kind: "rotation",
    pivot: cloneVec2(preview?.pivot ?? input.rigControl.pivot),
    restAngleDegrees,
    angleDegrees: evaluatedAngleDegrees,
    translation: cloneVec2(translation),
    scale: cloneVec2(input.rigControl.restScale ?? { x: 1, y: 1 })
  };
}

function createEvaluationRigDraft(
  draft: CanvasEvaluationRigDraft,
  orderIndex: number
): EvaluationRigControl {
  const common = {
    id: DRAFT_RIG_CONTROL_ID,
    source: "draft" as const,
    displayName:
      draft.displayName ?? (draft.kind === "rotation" ? "Draft Rotation Deformer" : "Draft Warp Deformer"),
    ...(draft.parentRigControlId === undefined ? {} : { parentId: draft.parentRigControlId }),
    childDrawableIds: [...draft.childDrawableIds],
    childRigControlIds: [...draft.childRigControlIds],
    enabled: true,
    opacityMultiplier: clamp01(draft.opacityMultiplier ?? 1),
    orderIndex
  };

  if (draft.kind === "rotation") {
    return {
      ...common,
      kind: "rotation",
      pivot: cloneVec2(draft.pivot),
      restAngleDegrees: draft.angleDegrees,
      angleDegrees: draft.angleDegrees,
      translation: { x: 0, y: 0 },
      scale: { x: 1, y: 1 }
    };
  }

  const expectedCount = Math.max(0, draft.transformColumns * draft.transformRows);
  return {
    ...common,
    kind: "warp",
    domainBounds: structuredClone(draft.domainBounds),
    latticeColumns: draft.transformColumns,
    latticeRows: draft.transformRows,
    bezierColumns: draft.bezierColumns ?? draft.transformColumns,
    bezierRows: draft.bezierRows ?? draft.transformRows,
    controlPointOffsets: normalizeControlPointOffsets(draft.controlPointOffsets, expectedCount)
  };
}

function createCanvasEvaluatedRigControls(
  rigControls: readonly EvaluationRigControl[],
  rigControlsById: ReadonlyMap<EvaluationRigControlId, EvaluationRigControl>
): readonly CanvasEvaluatedRigControl[] {
  return rigControls.map((rigControl) =>
    rigControl.kind === "warp"
      ? createCanvasEvaluatedWarpRigControl(rigControl, rigControlsById)
      : createCanvasEvaluatedRotationRigControl(rigControl, rigControlsById)
  );
}

function createCanvasEvaluatedWarpRigControl(
  rigControl: EvaluationWarpRigControl,
  rigControlsById: ReadonlyMap<EvaluationRigControlId, EvaluationRigControl>
): CanvasEvaluatedWarpRigControl {
  const chain = createDrawableRigControlChain(rigControl, rigControlsById);
  const restControlPoints = createWarpRestControlPoints(rigControl);
  const evaluatedControlPoints = restControlPoints.map((point) =>
    applyRigControlChainToPoint(point, chain)
  );

  return {
    kind: "warp",
    status: rigControl.source,
    ...(rigControl.sourceRigControlId === undefined
      ? {}
      : { rigControlId: rigControl.sourceRigControlId }),
    displayName: rigControl.displayName,
    domainBounds: computeBoundsFromVertices(evaluatedControlPoints),
    transformColumns: rigControl.latticeColumns,
    transformRows: rigControl.latticeRows,
    bezierColumns: rigControl.bezierColumns,
    bezierRows: rigControl.bezierRows,
    restControlPoints: restControlPoints.map(cloneVec2),
    controlPointOffsets: rigControl.controlPointOffsets.map(cloneVec2),
    evaluatedControlPoints,
    childDrawableIds: [...rigControl.childDrawableIds],
    childRigControlIds: toPublicRigControlIds(rigControl.childRigControlIds)
  };
}

function createCanvasEvaluatedRotationRigControl(
  rigControl: EvaluationRotationRigControl,
  rigControlsById: ReadonlyMap<EvaluationRigControlId, EvaluationRigControl>
): CanvasEvaluatedRotationRigControl {
  const chain = createDrawableRigControlChain(rigControl, rigControlsById);
  const evaluatedPivot = applyRigControlChainToPoint(rigControl.pivot, chain);

  return {
    kind: "rotation",
    status: rigControl.source,
    ...(rigControl.sourceRigControlId === undefined
      ? {}
      : { rigControlId: rigControl.sourceRigControlId }),
    displayName: rigControl.displayName,
    domainBounds: {
      x: evaluatedPivot.x - 16,
      y: evaluatedPivot.y - 16,
      width: 32,
      height: 32
    },
    pivot: evaluatedPivot,
    translation: cloneVec2(rigControl.translation),
    restAngleDegrees: rigControl.restAngleDegrees,
    evaluatedAngleDegrees: rigControl.angleDegrees,
    childDrawableIds: [...rigControl.childDrawableIds],
    childRigControlIds: toPublicRigControlIds(rigControl.childRigControlIds)
  };
}

function createWarpRestControlPoints(
  rigControl: EvaluationWarpRigControl
): readonly Vec2Dto[] {
  const points: Vec2Dto[] = [];
  const columns = Math.max(0, Math.floor(rigControl.latticeColumns));
  const rows = Math.max(0, Math.floor(rigControl.latticeRows));

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      points.push({
        x:
          rigControl.domainBounds.x +
          rigControl.domainBounds.width * toUnitGridPosition(column, columns),
        y:
          rigControl.domainBounds.y +
          rigControl.domainBounds.height * toUnitGridPosition(row, rows)
      });
    }
  }

  return points;
}

function toPublicRigControlIds(
  rigControlIds: readonly EvaluationRigControlId[]
): readonly RigControlId[] {
  return rigControlIds.filter(
    (rigControlId): rigControlId is RigControlId => rigControlId !== DRAFT_RIG_CONTROL_ID
  );
}

function createRigControlEvaluationOrder(
  rigControls: readonly EvaluationRigControl[]
): readonly EvaluationRigControlId[] {
  const rigControlsById = new Map(rigControls.map((rigControl) => [rigControl.id, rigControl]));
  const roots = rigControls
    .filter(
      (rigControl) =>
        rigControl.parentId === undefined || !rigControlsById.has(rigControl.parentId)
    )
    .sort(compareRigControlOrder)
    .map((rigControl) => rigControl.id);
  const ordered: EvaluationRigControlId[] = [];
  const visited = new Set<EvaluationRigControlId>();
  const visiting = new Set<EvaluationRigControlId>();
  const visit = (rigControlId: EvaluationRigControlId) => {
    if (visited.has(rigControlId) || visiting.has(rigControlId)) {
      return;
    }

    const rigControl = rigControlsById.get(rigControlId);
    if (rigControl === undefined) {
      return;
    }

    visiting.add(rigControlId);
    ordered.push(rigControlId);
    for (const childRigControlId of rigControl.childRigControlIds) {
      visit(childRigControlId);
    }
    visiting.delete(rigControlId);
    visited.add(rigControlId);
  };

  for (const rootId of roots) {
    visit(rootId);
  }
  for (const rigControl of [...rigControls].sort(compareRigControlOrder)) {
    visit(rigControl.id);
  }

  return ordered;
}

function createDirectRigControlByDrawableId(
  rigControlOrder: readonly EvaluationRigControlId[],
  rigControlsById: ReadonlyMap<EvaluationRigControlId, EvaluationRigControl>
): ReadonlyMap<DrawableId, EvaluationRigControl> {
  const result = new Map<DrawableId, EvaluationRigControl>();

  for (const rigControlId of rigControlOrder) {
    const rigControl = rigControlsById.get(rigControlId);
    if (rigControl === undefined) {
      continue;
    }

    for (const drawableId of rigControl.childDrawableIds) {
      if (!result.has(drawableId)) {
        result.set(drawableId, rigControl);
      }
    }
  }

  return result;
}

function createDrawableRigControlChain(
  directRigControl: EvaluationRigControl | undefined,
  rigControlsById: ReadonlyMap<EvaluationRigControlId, EvaluationRigControl>
): readonly EvaluationRigControl[] {
  if (directRigControl === undefined) {
    return [];
  }

  const chain: EvaluationRigControl[] = [];
  const visited = new Set<EvaluationRigControlId>();
  let current: EvaluationRigControl | undefined = directRigControl;

  while (current !== undefined && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current =
      current.parentId === undefined ? undefined : rigControlsById.get(current.parentId);
  }

  return chain;
}

function applyRigControlChainToVertices(input: {
  readonly currentVertices: readonly Vec2Dto[];
  readonly referenceVertices: readonly Vec2Dto[];
  readonly chain: readonly EvaluationRigControl[];
}): readonly Vec2Dto[] {
  if (input.currentVertices.length !== input.referenceVertices.length) {
    return input.currentVertices.map(cloneVec2);
  }

  let current = input.currentVertices.map(cloneVec2);
  const reference = input.referenceVertices.map(cloneVec2);

  for (const rigControl of createLocalSpaceEvaluationChain(input.chain)) {
    current = current.map((vertex, index) =>
      applyRigControlToPoint({
        currentPoint: vertex,
        referencePoint: reference[index] ?? vertex,
        rigControl
      })
    );
  }

  return current;
}

function applyRigControlChainToPoint(
  point: Vec2Dto,
  chain: readonly EvaluationRigControl[]
): Vec2Dto {
  let current = cloneVec2(point);
  const reference = cloneVec2(point);

  for (const rigControl of createLocalSpaceEvaluationChain(chain)) {
    current = applyRigControlToPoint({
      currentPoint: current,
      referencePoint: reference,
      rigControl
    });
  }

  return current;
}

function createLocalSpaceEvaluationChain(
  chain: readonly EvaluationRigControl[]
): readonly EvaluationRigControl[] {
  return [...chain].reverse();
}

function applyRigControlToPoint(input: {
  readonly rigControl: EvaluationRigControl;
  readonly currentPoint: Vec2Dto;
  readonly referencePoint: Vec2Dto;
}): Vec2Dto {
  if (!input.rigControl.enabled) {
    return cloneVec2(input.currentPoint);
  }

  if (input.rigControl.kind === "rotation") {
    return applyRotationToPoint({
      angleDegrees: input.rigControl.angleDegrees,
      pivot: input.rigControl.pivot,
      point: input.currentPoint,
      scale: input.rigControl.scale,
      translation: input.rigControl.translation
    });
  }

  return applyWarpLatticeToPoint({
    currentPoint: input.currentPoint,
    referencePoint: input.referencePoint,
    rigControl: input.rigControl
  });
}

function applyRotationToPoint(input: {
  readonly point: Vec2Dto;
  readonly pivot: Vec2Dto;
  readonly angleDegrees: number;
  readonly translation: Vec2Dto;
  readonly scale: Vec2Dto;
}): Vec2Dto {
  const radians = (input.angleDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localX = (input.point.x - input.pivot.x) * input.scale.x;
  const localY = (input.point.y - input.pivot.y) * input.scale.y;

  return {
    x: normalizeTransformNumber(
      input.pivot.x + localX * cos - localY * sin + input.translation.x
    ),
    y: normalizeTransformNumber(
      input.pivot.y + localX * sin + localY * cos + input.translation.y
    )
  };
}

function applyWarpLatticeToPoint(input: {
  readonly rigControl: EvaluationWarpRigControl;
  readonly currentPoint: Vec2Dto;
  readonly referencePoint: Vec2Dto;
}): Vec2Dto {
  const { rigControl } = input;

  if (
    rigControl.latticeColumns < 2 ||
    rigControl.latticeRows < 2 ||
    rigControl.domainBounds.width <= 0 ||
    rigControl.domainBounds.height <= 0 ||
    !pointInRect(input.referencePoint, rigControl.domainBounds)
  ) {
    return cloneVec2(input.currentPoint);
  }

  const normalizedX =
    (input.referencePoint.x - rigControl.domainBounds.x) / rigControl.domainBounds.width;
  const normalizedY =
    (input.referencePoint.y - rigControl.domainBounds.y) / rigControl.domainBounds.height;
  const gridX = clamp(normalizedX, 0, 1) * (rigControl.latticeColumns - 1);
  const gridY = clamp(normalizedY, 0, 1) * (rigControl.latticeRows - 1);
  const column = Math.min(Math.floor(gridX), rigControl.latticeColumns - 2);
  const row = Math.min(Math.floor(gridY), rigControl.latticeRows - 2);
  const tx = gridX - column;
  const ty = gridY - row;
  const lowerLeft = getControlPointOffset(rigControl, column, row);
  const lowerRight = getControlPointOffset(rigControl, column + 1, row);
  const upperLeft = getControlPointOffset(rigControl, column, row + 1);
  const upperRight = getControlPointOffset(rigControl, column + 1, row + 1);
  const lower = interpolateVec2(lowerLeft, lowerRight, tx);
  const upper = interpolateVec2(upperLeft, upperRight, tx);
  const displacement = interpolateVec2(lower, upper, ty);

  return {
    x: normalizeTransformNumber(input.currentPoint.x + displacement.x),
    y: normalizeTransformNumber(input.currentPoint.y + displacement.y)
  };
}

function createBaseEvaluatedMesh(input: {
  readonly drawableId: DrawableId;
  readonly mesh: MeshDto | undefined;
  readonly meshDraft: CanvasEvaluationOptions["meshDraft"];
  readonly fallbackBounds: RectDto;
}): CanvasEvaluatedMesh {
  if (input.meshDraft?.drawableId === input.drawableId) {
    return cloneMesh(input.meshDraft.mesh, "draft");
  }

  if (input.mesh !== undefined) {
    return cloneMesh(input.mesh, "committed");
  }

  return createRectFallbackMesh(input.fallbackBounds);
}

function createMeshDraftIndex(
  options: CanvasEvaluationOptions
): ReadonlyMap<DrawableId, NonNullable<CanvasEvaluationOptions["meshDraft"]>> {
  const drafts =
    options.meshDrafts ??
    options.meshDraft?.meshDrafts ??
    (options.meshDraft === undefined || options.meshDraft === null ? [] : [options.meshDraft]);

  return new Map(drafts.map((draft) => [draft.drawableId, draft]));
}

function cloneMesh(mesh: MeshDto, source: "committed" | "draft"): CanvasEvaluatedMesh {
  return {
    source,
    sourceMeshId: mesh.meshId,
    vertices: mesh.vertices.map(cloneVec2),
    uvs: mesh.uvs.map(cloneVec2),
    triangles: mesh.triangles.map(cloneTriangle),
    bounds: structuredClone(mesh.bounds),
    vertexStableIds: [...mesh.vertexStableIds]
  };
}

function createRectFallbackMesh(bounds: RectDto): CanvasEvaluatedMesh {
  const rect = {
    x: toFiniteNumber(bounds.x, 0),
    y: toFiniteNumber(bounds.y, 0),
    width: Math.max(1, toFiniteNumber(bounds.width, 1)),
    height: Math.max(1, toFiniteNumber(bounds.height, 1))
  };

  return {
    source: "rectFallback",
    vertices: [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ],
    triangles: [
      [0, 1, 2],
      [0, 2, 3]
    ],
    bounds: rect,
    vertexStableIds: ["vtx_rect_0", "vtx_rect_1", "vtx_rect_2", "vtx_rect_3"]
  };
}

function evaluateDrawableOpacity(input: {
  readonly baseOpacity: number;
  readonly chain: readonly EvaluationRigControl[];
}): number {
  return clamp01(
    input.chain.reduce(
      (opacity, rigControl) =>
        rigControl.enabled ? opacity * rigControl.opacityMultiplier : opacity,
      input.baseOpacity
    )
  );
}

function composeControlPointPreview(
  baseOffsets: readonly Vec2Dto[],
  preview: CanvasEvaluationControlPointPreview,
  expectedCount: number
): readonly Vec2Dto[] {
  const previewOffsets = normalizeControlPointOffsets(preview.controlPointOffsets, expectedCount);
  if (preview.compositionMode === "additiveDelta") {
    return baseOffsets.map((offset, index) => ({
      x: normalizeTransformNumber(offset.x + (previewOffsets[index]?.x ?? 0)),
      y: normalizeTransformNumber(offset.y + (previewOffsets[index]?.y ?? 0))
    }));
  }

  return previewOffsets;
}

function normalizeControlPointOffsets(
  offsets: readonly Vec2Dto[] | undefined,
  expectedCount: number
): readonly Vec2Dto[] {
  return Array.from({ length: Math.max(0, expectedCount) }, (_, index) => {
    const offset = offsets?.[index];
    return {
      x: toFiniteNumber(offset?.x, 0),
      y: toFiniteNumber(offset?.y, 0)
    };
  });
}

function getControlPointOffset(
  rigControl: EvaluationWarpRigControl,
  column: number,
  row: number
): Vec2Dto {
  return rigControl.controlPointOffsets[row * rigControl.latticeColumns + column] ?? { x: 0, y: 0 };
}

function resolveEvaluationCanvasBounds(session: AuthoringSession): RectDto {
  const drawableSourceAssetIds = new Set(session.graph.drawables.map((drawable) => drawable.sourceAssetId));
  const sourceCanvas = session.graph.sourceAssets.find(
    (sourceAsset) =>
      drawableSourceAssetIds.has(sourceAsset.sourceAssetId) &&
      sourceAsset.psdProfile?.canvas !== undefined
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

function computeBoundsFromVertices(vertices: readonly Vec2Dto[]): RectDto {
  const first = vertices[0];
  if (first === undefined) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;
  for (const vertex of vertices.slice(1)) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }

  return {
    x: normalizeTransformNumber(minX),
    y: normalizeTransformNumber(minY),
    width: normalizeTransformNumber(maxX - minX),
    height: normalizeTransformNumber(maxY - minY)
  };
}

function computeEvaluatedMeshBounds(
  baseMesh: CanvasEvaluatedMesh,
  vertices: readonly Vec2Dto[]
): RectDto {
  return vertices.length === 0
    ? structuredClone(baseMesh.bounds)
    : computeBoundsFromVertices(vertices);
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

function compareBackToFront(
  left: CanvasEvaluatedDrawable,
  right: CanvasEvaluatedDrawable
): number {
  const frontOrder = right.drawOrder - left.drawOrder;
  if (frontOrder !== 0) {
    return frontOrder;
  }

  return left.drawableId.localeCompare(right.drawableId);
}

function compareRigControlOrder(left: EvaluationRigControl, right: EvaluationRigControl): number {
  return left.orderIndex - right.orderIndex || left.id.localeCompare(right.id);
}

function cloneTriangle(
  triangle: readonly [number, number, number]
): readonly [number, number, number] {
  return [triangle[0], triangle[1], triangle[2]];
}

function cloneVec2(value: Vec2Dto): Vec2Dto {
  return {
    x: normalizeTransformNumber(value.x),
    y: normalizeTransformNumber(value.y)
  };
}

function interpolateVec2(left: Vec2Dto, right: Vec2Dto, t: number): Vec2Dto {
  return {
    x: normalizeTransformNumber(left.x + (right.x - left.x) * t),
    y: normalizeTransformNumber(left.y + (right.y - left.y) * t)
  };
}

function pointInRect(point: Vec2Dto, rect: RectDto): boolean {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function toFiniteNumber(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : value;
}

function normalizeTransformNumber(value: number): number {
  if (Math.abs(value) < 1e-12) {
    return 0;
  }

  return Number(value.toFixed(12));
}

function isWarpLatticeRigControl(
  rigControl: RigControlDto
): rigControl is WarpLatticeRigControlDto {
  return rigControl.kind === "warpLattice2d";
}

function isRotationRigControl(rigControl: RigControlDto): rigControl is RotationRigControlDto {
  return rigControl.kind === "rotation2d";
}

function isDefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}
