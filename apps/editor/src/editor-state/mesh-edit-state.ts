import { TriangleIdSchema, VertexIdSchema, type RectDto, type Vec2Dto } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { DrawableListItemState } from "./drawable-list-state.js";
import type { LayerTreeDraftState } from "./layer-tree-draft-state.js";

export const defaultMeshVertexNudgeStep = 1;
export const defaultMeshCanvasHitRadius = 6;

export interface MeshEditSelectedMeshState {
  readonly meshId: string;
  readonly drawableId: string;
  readonly drawableDisplayName: string;
  readonly bounds: RectDto;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly topologyRevision: number;
  readonly hasTriangleStableIds: boolean;
  readonly runtimeVisible: boolean;
  readonly editorHidden: boolean;
  readonly locked: boolean;
}

export interface EditableMeshVertexState {
  readonly vertexId: string;
  readonly vertexIndex: number;
  readonly position: Vec2Dto;
  readonly uv: Vec2Dto;
}

export interface EditableMeshTriangleState {
  readonly triangleId: string | null;
  readonly triangleIndex: number;
  readonly vertexIndexes: readonly [number, number, number];
  readonly vertexIds: readonly [string, string, string];
  readonly hasStableId: boolean;
  readonly removable: boolean;
}

export interface MeshEditTargetState {
  readonly selectedMesh: MeshEditSelectedMeshState;
  readonly editableVertices: readonly EditableMeshVertexState[];
  readonly editableTriangles: readonly EditableMeshTriangleState[];
}

export type MeshCanvasEditDisabledReason =
  | "noMesh"
  | "noEditableVertices"
  | "locked"
  | "editorHidden";

export interface MeshCanvasProjectionState {
  readonly origin: Vec2Dto;
  readonly scale: number;
  readonly hitRadius: number;
}

export interface MeshCanvasVertexHitTargetState {
  readonly meshId: string;
  readonly drawableId: string;
  readonly vertexId: string;
  readonly vertexIndex: number;
  readonly modelPosition: Vec2Dto;
  readonly canvasPosition: Vec2Dto;
  readonly hitRadius: number;
  readonly selected: boolean;
  readonly selectable: boolean;
  readonly editable: boolean;
  readonly runtimeVisible: boolean;
  readonly editorHidden: boolean;
  readonly locked: boolean;
  readonly disabledReason: MeshCanvasEditDisabledReason | null;
}

export interface MeshEditState {
  readonly selectedMesh: MeshEditSelectedMeshState | null;
  readonly editableVertices: readonly EditableMeshVertexState[];
  readonly editableTriangles: readonly EditableMeshTriangleState[];
  readonly meshTargets: readonly MeshEditTargetState[];
  readonly selectedVertexIds: readonly string[];
  readonly canvasProjection: MeshCanvasProjectionState;
  readonly canvasHitTargets: readonly MeshCanvasVertexHitTargetState[];
  readonly nudgeStep: number;
  readonly canNudgeSelectedMesh: boolean;
  readonly canDraftCanvasMeshMove: boolean;
  readonly editDisabledReason: MeshCanvasEditDisabledReason | null;
}

export interface MeshEditProjectionOptions {
  readonly layerTreeDraft?: LayerTreeDraftState;
  readonly selectedVertexIds?: readonly string[];
  readonly canvasProjection?: Partial<MeshCanvasProjectionState>;
}

export interface MeshEditReprojectionOptions extends MeshEditProjectionOptions {
  readonly drawables?: readonly DrawableListItemState[];
}

export const createEmptyMeshEditState = (): MeshEditState => ({
  selectedMesh: null,
  editableVertices: [],
  editableTriangles: [],
  meshTargets: [],
  selectedVertexIds: [],
  canvasProjection: createMeshCanvasProjection(),
  canvasHitTargets: [],
  nudgeStep: defaultMeshVertexNudgeStep,
  canNudgeSelectedMesh: false,
  canDraftCanvasMeshMove: false,
  editDisabledReason: "noMesh"
});

export const projectMeshEditState = (
  drawables: readonly DrawableListItemState[],
  meshes: readonly MeshDto[] = [],
  options: MeshEditProjectionOptions = {}
): MeshEditState => {
  const meshesById = new Map(meshes.map((mesh) => [String(mesh.meshId), mesh]));
  const lockedIds = new Set(options.layerTreeDraft?.lockedIds ?? []);
  const editorHiddenIds = new Set(options.layerTreeDraft?.editorHiddenIds ?? []);
  const candidates = drawables.flatMap((drawable) => {
    const mesh = meshesById.get(drawable.meshId);
    if (mesh === undefined) {
      return [];
    }

    return [
      {
        selectedMesh: {
          meshId: mesh.meshId,
          drawableId: drawable.drawableId,
          drawableDisplayName: drawable.displayName,
          bounds: structuredClone(mesh.bounds),
          vertexCount: mesh.vertices.length,
          triangleCount: mesh.triangles.length,
          topologyRevision: mesh.topologyRevision ?? 0,
          hasTriangleStableIds: hasAlignedTriangleStableIds(mesh),
          runtimeVisible: drawable.visible,
          editorHidden: editorHiddenIds.has(drawable.drawableId),
          locked: lockedIds.has(drawable.drawableId)
        },
        editableVertices: projectEditableVertices(mesh),
        editableTriangles: projectEditableTriangles(mesh)
      }
    ];
  });

  return projectMeshEditStateFromTargets(candidates, options);
};

export const reprojectMeshEditState = (
  state: MeshEditState,
  options: MeshEditReprojectionOptions = {}
): MeshEditState => {
  const lockedIds = new Set(options.layerTreeDraft?.lockedIds ?? []);
  const editorHiddenIds = new Set(options.layerTreeDraft?.editorHiddenIds ?? []);
  const drawablesByDrawableId = new Map(
    (options.drawables ?? []).map((drawable) => [drawable.drawableId, drawable])
  );
  const drawablesByMeshId = new Map(
    (options.drawables ?? []).map((drawable) => [drawable.meshId, drawable])
  );
  const meshTargets: MeshEditTargetState[] = state.meshTargets.flatMap((target): MeshEditTargetState[] => {
    const drawable =
      drawablesByDrawableId.get(target.selectedMesh.drawableId) ??
      drawablesByMeshId.get(target.selectedMesh.meshId);
    if (options.drawables !== undefined && drawable === undefined) {
      return [];
    }
    const drawableId = drawable?.drawableId ?? target.selectedMesh.drawableId;

    return [
      {
        selectedMesh: {
          ...target.selectedMesh,
          ...(drawable === undefined
            ? {}
            : {
                drawableId: drawable.drawableId,
                drawableDisplayName: drawable.displayName,
                runtimeVisible: drawable.visible
              }),
          locked: lockedIds.has(drawableId),
          editorHidden: editorHiddenIds.has(drawableId)
        },
        editableVertices: target.editableVertices.map((vertex) => ({
          vertexId: vertex.vertexId,
          vertexIndex: vertex.vertexIndex,
          position: {
            x: vertex.position.x,
            y: vertex.position.y
          },
          uv: {
            x: vertex.uv.x,
            y: vertex.uv.y
          }
        })),
        editableTriangles: target.editableTriangles.map((triangle) => ({
          triangleId: triangle.triangleId,
          triangleIndex: triangle.triangleIndex,
          vertexIndexes: [
            triangle.vertexIndexes[0],
            triangle.vertexIndexes[1],
            triangle.vertexIndexes[2]
          ] as [number, number, number],
          vertexIds: [
            triangle.vertexIds[0],
            triangle.vertexIds[1],
            triangle.vertexIds[2]
          ] as [string, string, string],
          hasStableId: triangle.hasStableId,
          removable: triangle.removable
        }))
      }
    ];
  });

  return projectMeshEditStateFromTargets(meshTargets, {
    ...options,
    selectedVertexIds: options.selectedVertexIds ?? state.selectedVertexIds,
    canvasProjection: options.canvasProjection ?? state.canvasProjection
  });
};

const projectMeshEditStateFromTargets = (
  meshTargets: readonly MeshEditTargetState[],
  options: MeshEditProjectionOptions = {}
): MeshEditState => {
  const canvasProjection = createMeshCanvasProjection(options.canvasProjection);
  const requestedSelectedVertexIds = options.selectedVertexIds ?? [];
  const requestedSelectedVertexIdSet = new Set(
    requestedSelectedVertexIds
      .map((vertexId) => vertexId.trim())
      .filter((vertexId) => vertexId.length > 0)
  );
  const selectedByLayerSelection = (options.layerTreeDraft?.selection ?? [])
    .map((drawableId) =>
      meshTargets.find((candidate) => candidate.selectedMesh.drawableId === drawableId)
    )
    .find((candidate) => candidate !== undefined);
  const selectedByVertexSelection = meshTargets.find((candidate) =>
    candidate.editableVertices.some((vertex) => requestedSelectedVertexIdSet.has(vertex.vertexId))
  );
  const selected = selectedByLayerSelection ??
    selectedByVertexSelection ??
    meshTargets.find((candidate) => candidate.editableVertices.length > 0) ??
    meshTargets[0];

  if (selected === undefined) {
    return {
      ...createEmptyMeshEditState(),
      meshTargets,
      canvasProjection
    };
  }

  const selectedVertexIds = normalizeSelectedVertexIds(
    options.selectedVertexIds ?? [],
    selected.editableVertices
  );
  const editDisabledReason = resolveMeshCanvasEditDisabledReason(
    selected.selectedMesh,
    selected.editableVertices
  );
  const canNudgeSelectedMesh = editDisabledReason === null;
  const canvasHitTargets = projectMeshCanvasHitTargets({
    selectedMesh: selected.selectedMesh,
    editableVertices: selected.editableVertices,
    selectedVertexIds,
    canvasProjection,
    editDisabledReason
  });

  return {
    selectedMesh: selected.selectedMesh,
    editableVertices: selected.editableVertices,
    editableTriangles: selected.editableTriangles,
    meshTargets,
    selectedVertexIds,
    canvasProjection,
    canvasHitTargets,
    nudgeStep: defaultMeshVertexNudgeStep,
    canNudgeSelectedMesh,
    canDraftCanvasMeshMove: canNudgeSelectedMesh && selectedVertexIds.length > 0,
    editDisabledReason
  };
};

const projectEditableVertices = (mesh: MeshDto): readonly EditableMeshVertexState[] =>
  mesh.vertices.flatMap((position, vertexIndex) => {
    const vertexId = mesh.vertexStableIds[vertexIndex];
    if (vertexId === undefined || !VertexIdSchema.safeParse(vertexId).success) {
      return [];
    }

    return [
      {
        vertexId,
        vertexIndex,
        position: {
          x: position.x,
          y: position.y
        },
        uv: {
          x: mesh.uvs[vertexIndex]?.x ?? 0,
          y: mesh.uvs[vertexIndex]?.y ?? 0
        }
      }
    ];
  });

const projectEditableTriangles = (mesh: MeshDto): readonly EditableMeshTriangleState[] =>
  mesh.triangles.flatMap((triangle, triangleIndex) => {
    const vertexIds = triangle.map((vertexIndex) => mesh.vertexStableIds[vertexIndex]);
    const triangleId = mesh.triangleStableIds?.[triangleIndex] ?? null;
    const removable = triangleId !== null && TriangleIdSchema.safeParse(triangleId).success;

    if (
      vertexIds[0] === undefined ||
      vertexIds[1] === undefined ||
      vertexIds[2] === undefined
    ) {
      return [];
    }

    return [
      {
        triangleId,
        triangleIndex,
        vertexIndexes: [triangle[0], triangle[1], triangle[2]],
        vertexIds: [vertexIds[0], vertexIds[1], vertexIds[2]],
        hasStableId: triangleId !== null,
        removable
      }
    ];
  });

export const normalizeSelectedMeshVertexIds = (
  selectedVertexIds: readonly string[],
  editableVertices: readonly EditableMeshVertexState[]
): readonly string[] => normalizeSelectedVertexIds(selectedVertexIds, editableVertices);

export const createMeshEditStateWithSelectedVertices = (
  state: MeshEditState,
  selectedVertexIds: readonly string[]
): MeshEditState => {
  const normalizedSelectedVertexIds = normalizeSelectedVertexIds(
    selectedVertexIds,
    state.editableVertices
  );
  const selectedIds = new Set(normalizedSelectedVertexIds);
  const canDraftCanvasMeshMove =
    state.canNudgeSelectedMesh && normalizedSelectedVertexIds.length > 0;

  return {
    ...state,
    selectedVertexIds: normalizedSelectedVertexIds,
    canvasHitTargets: state.canvasHitTargets.map((target) => ({
      ...target,
      selected: selectedIds.has(target.vertexId)
    })),
    canDraftCanvasMeshMove
  };
};

const createMeshCanvasProjection = (
  input: Partial<MeshCanvasProjectionState> = {}
): MeshCanvasProjectionState => ({
  origin: {
    x: normalizeFiniteNumber(input.origin?.x, 0),
    y: normalizeFiniteNumber(input.origin?.y, 0)
  },
  scale: normalizePositiveNumber(input.scale, 1),
  hitRadius: normalizePositiveNumber(input.hitRadius, defaultMeshCanvasHitRadius)
});

const projectMeshCanvasHitTargets = (input: {
  readonly selectedMesh: MeshEditSelectedMeshState;
  readonly editableVertices: readonly EditableMeshVertexState[];
  readonly selectedVertexIds: readonly string[];
  readonly canvasProjection: MeshCanvasProjectionState;
  readonly editDisabledReason: MeshCanvasEditDisabledReason | null;
}): readonly MeshCanvasVertexHitTargetState[] => {
  if (input.selectedMesh.editorHidden) {
    return [];
  }

  const selectedIds = new Set(input.selectedVertexIds);
  const disabledReason =
    input.editDisabledReason === "locked" ? input.editDisabledReason : null;
  const selectable = disabledReason === null;

  return input.editableVertices.map((vertex) => ({
    meshId: input.selectedMesh.meshId,
    drawableId: input.selectedMesh.drawableId,
    vertexId: vertex.vertexId,
    vertexIndex: vertex.vertexIndex,
    modelPosition: {
      x: vertex.position.x,
      y: vertex.position.y
    },
    canvasPosition: projectCanvasPosition(vertex.position, input.canvasProjection),
    hitRadius: input.canvasProjection.hitRadius,
    selected: selectedIds.has(vertex.vertexId),
    selectable,
    editable: selectable,
    runtimeVisible: input.selectedMesh.runtimeVisible,
    editorHidden: input.selectedMesh.editorHidden,
    locked: input.selectedMesh.locked,
    disabledReason
  }));
};

const projectCanvasPosition = (
  position: Vec2Dto,
  projection: MeshCanvasProjectionState
): Vec2Dto => ({
  x: projection.origin.x + position.x * projection.scale,
  y: projection.origin.y + position.y * projection.scale
});

const resolveMeshCanvasEditDisabledReason = (
  selectedMesh: MeshEditSelectedMeshState,
  editableVertices: readonly EditableMeshVertexState[]
): MeshCanvasEditDisabledReason | null => {
  if (selectedMesh.editorHidden) {
    return "editorHidden";
  }

  if (selectedMesh.locked) {
    return "locked";
  }

  if (editableVertices.length === 0) {
    return "noEditableVertices";
  }

  return null;
};

const normalizeSelectedVertexIds = (
  selectedVertexIds: readonly string[],
  editableVertices: readonly EditableMeshVertexState[]
): readonly string[] => {
  const requestedIds = new Set(
    selectedVertexIds
      .map((vertexId) => vertexId.trim())
      .filter((vertexId) => vertexId.length > 0)
  );

  return editableVertices
    .filter((vertex) => requestedIds.has(vertex.vertexId))
    .map((vertex) => vertex.vertexId);
};

const normalizeFiniteNumber = (value: number | undefined, fallback: number): number =>
  value === undefined || !Number.isFinite(value) ? fallback : value;

const normalizePositiveNumber = (value: number | undefined, fallback: number): number =>
  value === undefined || !Number.isFinite(value) || value <= 0 ? fallback : value;

const hasAlignedTriangleStableIds = (mesh: MeshDto): boolean =>
  mesh.triangleStableIds !== undefined && mesh.triangleStableIds.length === mesh.triangles.length;
