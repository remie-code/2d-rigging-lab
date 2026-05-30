import type { EditorSemanticState } from "./editor-semantic-state.js";
import { formatBoundsLabel, formatPreviewNumber } from "./view-model-format.js";

export type MeshVertexNudgeDirection = "left" | "right" | "up" | "down";

export interface MeshVertexNudgeViewModelCommand {
  readonly meshId: string;
  readonly vertexId: string;
  readonly delta: {
    readonly x: number;
    readonly y: number;
  };
  readonly intent: string;
}

export interface MeshVertexNudgeCommandSetViewModel {
  readonly left: MeshVertexNudgeViewModelCommand;
  readonly right: MeshVertexNudgeViewModelCommand;
  readonly up: MeshVertexNudgeViewModelCommand;
  readonly down: MeshVertexNudgeViewModelCommand;
}

export interface EditableMeshVertexViewModel {
  readonly vertexId: string;
  readonly vertexIndex: number;
  readonly x: number;
  readonly y: number;
  readonly positionLabel: string;
  readonly nudgeCommands: MeshVertexNudgeCommandSetViewModel;
  readonly nudgeLeftLabel: string;
  readonly nudgeRightLabel: string;
  readonly nudgeUpLabel: string;
  readonly nudgeDownLabel: string;
}

export interface SelectedMeshViewModel {
  readonly meshId: string;
  readonly drawableId: string;
  readonly drawableDisplayName: string;
  readonly boundsLabel: string;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly vertexCountLabel: string;
}

export interface MeshEditResultViewModel {
  readonly operationId: string;
  readonly status: string;
  readonly diagnosticCount: number;
}

export interface MeshEditViewModel {
  readonly selectedMesh: SelectedMeshViewModel | null;
  readonly editableVertices: readonly EditableMeshVertexViewModel[];
  readonly hasSelectedMesh: boolean;
  readonly hasEditableVertices: boolean;
  readonly canNudgeSelectedMesh: boolean;
  readonly nudgeStep: number;
  readonly selectedMeshLabel: string;
  readonly editableVertexCountLabel: string;
  readonly emptyMessage: string;
  readonly lastMeshEditResult: MeshEditResultViewModel | null;
  readonly lastMeshEditResultLabel: string;
}

export const projectMeshEditViewModel = (state: EditorSemanticState): MeshEditViewModel => {
  const selectedMesh = state.meshEdit.selectedMesh;
  const selectedMeshViewModel =
    selectedMesh === null
      ? null
      : {
          meshId: selectedMesh.meshId,
          drawableId: selectedMesh.drawableId,
          drawableDisplayName: selectedMesh.drawableDisplayName,
          boundsLabel: formatBoundsLabel(selectedMesh.bounds),
          vertexCount: selectedMesh.vertexCount,
          triangleCount: selectedMesh.triangleCount,
          vertexCountLabel: `${selectedMesh.vertexCount} vertices / ${selectedMesh.triangleCount} triangles`
        };
  const editableVertices =
    selectedMesh === null
      ? []
      : state.meshEdit.editableVertices.map((vertex) =>
          projectEditableMeshVertexViewModel({
            meshId: selectedMesh.meshId,
            vertex,
            nudgeStep: state.meshEdit.nudgeStep
          })
        );
  const lastMeshEditResult = projectLastMeshEditResult(state);

  return {
    selectedMesh: selectedMeshViewModel,
    editableVertices,
    hasSelectedMesh: selectedMesh !== null,
    hasEditableVertices: editableVertices.length > 0,
    canNudgeSelectedMesh: state.meshEdit.canNudgeSelectedMesh,
    nudgeStep: state.meshEdit.nudgeStep,
    selectedMeshLabel:
      selectedMesh === null
        ? "No mesh selected"
        : `${selectedMesh.drawableDisplayName} / ${selectedMesh.meshId}`,
    editableVertexCountLabel: `${editableVertices.length} editable ${editableVertices.length === 1 ? "vertex" : "vertices"}`,
    emptyMessage:
      state.loadedPackage === null
        ? "No package loaded"
        : "No editable mesh vertices available",
    lastMeshEditResult,
    lastMeshEditResultLabel:
      lastMeshEditResult === null
        ? "No mesh edit committed"
        : `moveMeshVertex ${lastMeshEditResult.status}`
  };
};

const projectEditableMeshVertexViewModel = (input: {
  readonly meshId: string;
  readonly vertex: EditorSemanticState["meshEdit"]["editableVertices"][number];
  readonly nudgeStep: number;
}): EditableMeshVertexViewModel => {
  const { meshId, vertex, nudgeStep } = input;

  return {
    vertexId: vertex.vertexId,
    vertexIndex: vertex.vertexIndex,
    x: vertex.position.x,
    y: vertex.position.y,
    positionLabel: `${formatPreviewNumber(vertex.position.x)}, ${formatPreviewNumber(vertex.position.y)}`,
    nudgeCommands: {
      left: createMeshVertexNudgeCommand(meshId, vertex.vertexId, "left", {
        x: -nudgeStep,
        y: 0
      }),
      right: createMeshVertexNudgeCommand(meshId, vertex.vertexId, "right", {
        x: nudgeStep,
        y: 0
      }),
      up: createMeshVertexNudgeCommand(meshId, vertex.vertexId, "up", {
        x: 0,
        y: -nudgeStep
      }),
      down: createMeshVertexNudgeCommand(meshId, vertex.vertexId, "down", {
        x: 0,
        y: nudgeStep
      })
    },
    nudgeLeftLabel: `Nudge ${vertex.vertexId} left`,
    nudgeRightLabel: `Nudge ${vertex.vertexId} right`,
    nudgeUpLabel: `Nudge ${vertex.vertexId} up`,
    nudgeDownLabel: `Nudge ${vertex.vertexId} down`
  };
};

const createMeshVertexNudgeCommand = (
  meshId: string,
  vertexId: string,
  direction: MeshVertexNudgeDirection,
  delta: { readonly x: number; readonly y: number }
): MeshVertexNudgeViewModelCommand => ({
  meshId,
  vertexId,
  delta,
  intent: `Nudge ${vertexId} ${direction} by ${formatPreviewNumber(Math.max(Math.abs(delta.x), Math.abs(delta.y)))} canvas unit.`
});

const projectLastMeshEditResult = (state: EditorSemanticState): MeshEditResultViewModel | null => {
  const result = state.lastOperationResult;
  if (result === null || result.operationType !== "moveMeshVertex") {
    return null;
  }

  return {
    operationId: result.operationId,
    status: result.status,
    diagnosticCount: result.diagnosticCount
  };
};
