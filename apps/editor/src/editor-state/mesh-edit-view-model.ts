import type { EditorSemanticState } from "./editor-semantic-state.js";
import type {
  MeshCanvasEditDisabledReason,
  MeshCanvasVertexHitTargetState
} from "./mesh-edit-state.js";
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
  readonly canvasX: number;
  readonly canvasY: number;
  readonly hitRadius: number;
  readonly selected: boolean;
  readonly positionLabel: string;
  readonly canvasPositionLabel: string;
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
  readonly runtimeVisible: boolean;
  readonly editorHidden: boolean;
  readonly locked: boolean;
  readonly vertexCountLabel: string;
  readonly runtimeVisibilityLabel: string;
  readonly editorVisibilityLabel: string;
  readonly lockedLabel: string;
  readonly editabilityLabel: string;
}

export interface MeshCanvasHitTargetViewModel {
  readonly meshId: string;
  readonly drawableId: string;
  readonly vertexId: string;
  readonly vertexIndex: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly selected: boolean;
  readonly selectable: boolean;
  readonly editable: boolean;
  readonly stateLabel: string;
  readonly ariaLabel: string;
}

export interface MeshCanvasSelectionViewModel {
  readonly selectedVertexIds: readonly string[];
  readonly hitTargets: readonly MeshCanvasHitTargetViewModel[];
  readonly hasHitTargets: boolean;
  readonly canDraftMove: boolean;
  readonly editDisabledReason: MeshCanvasEditDisabledReason | null;
  readonly selectedVertexCountLabel: string;
  readonly hitTargetCountLabel: string;
  readonly editabilityLabel: string;
}

export interface MeshEditResultViewModel {
  readonly operationId: string;
  readonly status: string;
  readonly diagnosticCount: number;
}

export interface MeshEditViewModel {
  readonly selectedMesh: SelectedMeshViewModel | null;
  readonly editableVertices: readonly EditableMeshVertexViewModel[];
  readonly canvasSelection: MeshCanvasSelectionViewModel;
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
          runtimeVisible: selectedMesh.runtimeVisible,
          editorHidden: selectedMesh.editorHidden,
          locked: selectedMesh.locked,
          vertexCountLabel: `${selectedMesh.vertexCount} vertices / ${selectedMesh.triangleCount} triangles`,
          runtimeVisibilityLabel: selectedMesh.runtimeVisible ? "Runtime visible" : "Runtime hidden",
          editorVisibilityLabel: selectedMesh.editorHidden ? "Editor hidden" : "Editor visible",
          lockedLabel: selectedMesh.locked ? "Locked" : "Unlocked",
          editabilityLabel: formatMeshEditabilityLabel(state.meshEdit.editDisabledReason)
        };
  const hitTargetsByVertexId = new Map(
    state.meshEdit.canvasHitTargets.map((target) => [target.vertexId, target])
  );
  const editableVertices =
    selectedMesh === null
      ? []
      : state.meshEdit.editableVertices.map((vertex) =>
          projectEditableMeshVertexViewModel({
            meshId: selectedMesh.meshId,
            vertex,
            hitTarget: hitTargetsByVertexId.get(vertex.vertexId),
            nudgeStep: state.meshEdit.nudgeStep
          })
        );
  const lastMeshEditResult = projectLastMeshEditResult(state);

  return {
    selectedMesh: selectedMeshViewModel,
    editableVertices,
    canvasSelection: projectMeshCanvasSelectionViewModel(state.meshEdit),
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
  readonly hitTarget: MeshCanvasVertexHitTargetState | undefined;
  readonly nudgeStep: number;
}): EditableMeshVertexViewModel => {
  const { meshId, vertex, hitTarget, nudgeStep } = input;
  const canvasPosition = hitTarget?.canvasPosition ?? vertex.position;
  const hitRadius = hitTarget?.hitRadius ?? 0;
  const selected = hitTarget?.selected ?? false;

  return {
    vertexId: vertex.vertexId,
    vertexIndex: vertex.vertexIndex,
    x: vertex.position.x,
    y: vertex.position.y,
    canvasX: canvasPosition.x,
    canvasY: canvasPosition.y,
    hitRadius,
    selected,
    positionLabel: `${formatPreviewNumber(vertex.position.x)}, ${formatPreviewNumber(vertex.position.y)}`,
    canvasPositionLabel: `${formatPreviewNumber(canvasPosition.x)}, ${formatPreviewNumber(canvasPosition.y)}`,
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

const projectMeshCanvasSelectionViewModel = (
  meshEdit: EditorSemanticState["meshEdit"]
): MeshCanvasSelectionViewModel => ({
  selectedVertexIds: meshEdit.selectedVertexIds,
  hitTargets: meshEdit.canvasHitTargets.map(projectMeshCanvasHitTargetViewModel),
  hasHitTargets: meshEdit.canvasHitTargets.length > 0,
  canDraftMove: meshEdit.canDraftCanvasMeshMove,
  editDisabledReason: meshEdit.editDisabledReason,
  selectedVertexCountLabel: `${meshEdit.selectedVertexIds.length} selected ${meshEdit.selectedVertexIds.length === 1 ? "vertex" : "vertices"}`,
  hitTargetCountLabel: `${meshEdit.canvasHitTargets.length} canvas ${meshEdit.canvasHitTargets.length === 1 ? "target" : "targets"}`,
  editabilityLabel: formatMeshEditabilityLabel(meshEdit.editDisabledReason)
});

const projectMeshCanvasHitTargetViewModel = (
  hitTarget: MeshCanvasVertexHitTargetState
): MeshCanvasHitTargetViewModel => {
  const stateLabel = [
    hitTarget.runtimeVisible ? "Runtime visible" : "Runtime hidden",
    hitTarget.editorHidden ? "Editor hidden" : "Editor visible",
    hitTarget.locked ? "Locked" : "Unlocked",
    hitTarget.selected ? "Selected" : "Not selected",
    hitTarget.selectable ? "Selectable" : "Read-only"
  ].join(" / ");

  return {
    meshId: hitTarget.meshId,
    drawableId: hitTarget.drawableId,
    vertexId: hitTarget.vertexId,
    vertexIndex: hitTarget.vertexIndex,
    x: hitTarget.canvasPosition.x,
    y: hitTarget.canvasPosition.y,
    radius: hitTarget.hitRadius,
    selected: hitTarget.selected,
    selectable: hitTarget.selectable,
    editable: hitTarget.editable,
    stateLabel,
    ariaLabel: `Mesh vertex ${hitTarget.vertexId} at ${formatPreviewNumber(hitTarget.canvasPosition.x)}, ${formatPreviewNumber(hitTarget.canvasPosition.y)} / ${stateLabel}`
  };
};

const formatMeshEditabilityLabel = (
  reason: MeshCanvasEditDisabledReason | null
): string => {
  switch (reason) {
    case null:
      return "Editable";
    case "noMesh":
      return "No mesh selected";
    case "noEditableVertices":
      return "No editable vertices";
    case "locked":
      return "Locked";
    case "editorHidden":
      return "Editor hidden";
  }
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
