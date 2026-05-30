import { VertexIdSchema, type RectDto, type Vec2Dto } from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import type { DrawableListItemState } from "./drawable-list-state.js";

export const defaultMeshVertexNudgeStep = 1;

export interface MeshEditSelectedMeshState {
  readonly meshId: string;
  readonly drawableId: string;
  readonly drawableDisplayName: string;
  readonly bounds: RectDto;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export interface EditableMeshVertexState {
  readonly vertexId: string;
  readonly vertexIndex: number;
  readonly position: Vec2Dto;
}

export interface MeshEditState {
  readonly selectedMesh: MeshEditSelectedMeshState | null;
  readonly editableVertices: readonly EditableMeshVertexState[];
  readonly nudgeStep: number;
  readonly canNudgeSelectedMesh: boolean;
}

export const createEmptyMeshEditState = (): MeshEditState => ({
  selectedMesh: null,
  editableVertices: [],
  nudgeStep: defaultMeshVertexNudgeStep,
  canNudgeSelectedMesh: false
});

export const projectMeshEditState = (
  drawables: readonly DrawableListItemState[],
  meshes: readonly MeshDto[] = []
): MeshEditState => {
  const meshesById = new Map(meshes.map((mesh) => [String(mesh.meshId), mesh]));
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
          triangleCount: mesh.triangles.length
        },
        editableVertices: projectEditableVertices(mesh)
      }
    ];
  });
  const selected =
    candidates.find((candidate) => candidate.editableVertices.length > 0) ??
    candidates[0];

  if (selected === undefined) {
    return createEmptyMeshEditState();
  }

  return {
    selectedMesh: selected.selectedMesh,
    editableVertices: selected.editableVertices,
    nudgeStep: defaultMeshVertexNudgeStep,
    canNudgeSelectedMesh: selected.editableVertices.length > 0
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
        }
      }
    ];
  });
