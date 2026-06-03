import type { EditorSemanticState } from "./editor-semantic-state.js";
import {
  createMeshAddTriangleDraftCommand,
  createMeshAddVertexDraftCommand,
  createMeshRemoveSelectedVertexDraftCommand,
  createMeshRemoveTriangleDraftCommand,
  createMeshUvNudgeDelta,
  createMeshUvNudgeDraftCommand,
  defaultMeshUvNudgeStep,
  type MeshTopologyAddTriangleDraftCommand,
  type MeshTopologyAddVertexDraftCommand,
  type MeshTopologyDraftBlockedReason,
  type MeshTopologyRemoveTriangleDraftCommand,
  type MeshTopologyRemoveVertexDraftCommand,
  type MeshUvNudgeDirection,
  type MeshUvNudgeDraftCommand
} from "./mesh-topology-edit-state.js";
import { formatPreviewNumber } from "./view-model-format.js";

export interface MeshTopologyActionViewModel<TCommand> {
  readonly command: TCommand | null;
  readonly disabled: boolean;
  readonly disabledReason: MeshTopologyDraftBlockedReason | null;
  readonly disabledLabel: string | null;
  readonly label: string;
}

export interface MeshTopologyTriangleViewModel {
  readonly triangleIndex: number;
  readonly triangleId: string | null;
  readonly triangleLabel: string;
  readonly vertexLabel: string;
  readonly remove: MeshTopologyActionViewModel<MeshTopologyRemoveTriangleDraftCommand>;
}

export interface MeshUvNudgeButtonViewModel {
  readonly direction: MeshUvNudgeDirection;
  readonly text: string;
  readonly command: MeshUvNudgeDraftCommand | null;
  readonly disabled: boolean;
  readonly disabledLabel: string | null;
  readonly ariaLabel: string;
}

export interface MeshTopologyControlsViewModel {
  readonly statusLabel: string;
  readonly topologyRevisionLabel: string;
  readonly stableTriangleStatusLabel: string;
  readonly selectedVertexCountLabel: string;
  readonly addVertex: MeshTopologyActionViewModel<MeshTopologyAddVertexDraftCommand>;
  readonly removeSelectedVertex: MeshTopologyActionViewModel<MeshTopologyRemoveVertexDraftCommand>;
  readonly addTriangle: MeshTopologyActionViewModel<MeshTopologyAddTriangleDraftCommand>;
  readonly uvNudges: readonly MeshUvNudgeButtonViewModel[];
  readonly uvStepLabel: string;
  readonly triangles: readonly MeshTopologyTriangleViewModel[];
  readonly triangleCountLabel: string;
  readonly hasTriangles: boolean;
  readonly lastTopologyResultLabel: string;
}

export const projectMeshTopologyControlsViewModel = (
  state: EditorSemanticState
): MeshTopologyControlsViewModel => {
  const meshEdit = state.meshEdit;
  const selectedMesh = meshEdit.selectedMesh;
  const addVertex = projectTopologyAction(
    createMeshAddVertexDraftCommand(meshEdit),
    "Add vertex"
  );
  const removeSelectedVertex = projectTopologyAction(
    createMeshRemoveSelectedVertexDraftCommand(meshEdit),
    "Remove selected vertex"
  );
  const addTriangle = projectTopologyAction(
    createMeshAddTriangleDraftCommand(meshEdit),
    "Add triangle"
  );

  return {
    statusLabel:
      selectedMesh === null
        ? "No mesh selected"
        : `${selectedMesh.meshId} / ${selectedMesh.vertexCount} vertices / ${selectedMesh.triangleCount} triangles`,
    topologyRevisionLabel:
      selectedMesh === null
        ? "Topology revision unavailable"
        : `Topology r${selectedMesh.topologyRevision}`,
    stableTriangleStatusLabel:
      selectedMesh === null
        ? "No triangle list"
        : selectedMesh.hasTriangleStableIds
          ? "Stable triangle IDs available"
          : "Triangle removal requires stable triangle IDs",
    selectedVertexCountLabel:
      `${meshEdit.selectedVertexIds.length} selected ${meshEdit.selectedVertexIds.length === 1 ? "vertex" : "vertices"}`,
    addVertex,
    removeSelectedVertex,
    addTriangle,
    uvNudges: projectMeshUvNudges(meshEdit),
    uvStepLabel: `UV step ${formatPreviewNumber(defaultMeshUvNudgeStep)}`,
    triangles: meshEdit.editableTriangles.map((triangle) =>
      projectMeshTopologyTriangleViewModel(meshEdit, triangle)
    ),
    triangleCountLabel: `${meshEdit.editableTriangles.length} listed ${meshEdit.editableTriangles.length === 1 ? "triangle" : "triangles"}`,
    hasTriangles: meshEdit.editableTriangles.length > 0,
    lastTopologyResultLabel: projectLastTopologyResultLabel(state)
  };
};

const projectTopologyAction = <TCommand>(
  draft: {
    readonly command: TCommand | null;
    readonly blockedReason: MeshTopologyDraftBlockedReason | null;
  },
  label: string
): MeshTopologyActionViewModel<TCommand> => ({
  command: draft.command,
  disabled: draft.command === null,
  disabledReason: draft.blockedReason,
  disabledLabel: formatTopologyBlockedReason(draft.blockedReason),
  label
});

const projectMeshTopologyTriangleViewModel = (
  meshEdit: EditorSemanticState["meshEdit"],
  triangle: EditorSemanticState["meshEdit"]["editableTriangles"][number]
): MeshTopologyTriangleViewModel => {
  const draft = triangle.triangleId === null
    ? {
        command: null,
        blockedReason: "missingTriangleStableId" as const
      }
    : createMeshRemoveTriangleDraftCommand(meshEdit, triangle.triangleId);

  return {
    triangleIndex: triangle.triangleIndex,
    triangleId: triangle.triangleId,
    triangleLabel: triangle.triangleId === null
      ? `#${triangle.triangleIndex} no stable ID`
      : `#${triangle.triangleIndex} ${triangle.triangleId}`,
    vertexLabel: triangle.vertexIds.join(", "),
    remove: projectTopologyAction(draft, "Remove triangle")
  };
};

const projectMeshUvNudges = (
  meshEdit: EditorSemanticState["meshEdit"]
): readonly MeshUvNudgeButtonViewModel[] =>
  (["left", "right", "up", "down"] as const).map((direction) => {
    const delta = createMeshUvNudgeDelta(direction);
    const draft = createMeshUvNudgeDraftCommand(meshEdit, delta);
    const axisLabel = direction === "left"
      ? "-U"
      : direction === "right"
        ? "+U"
        : direction === "up"
          ? "-V"
          : "+V";
    const disabledLabel = formatTopologyBlockedReason(draft.blockedReason);

    return {
      direction,
      text: axisLabel,
      command: draft.command,
      disabled: draft.command === null,
      disabledLabel,
      ariaLabel: disabledLabel === null
        ? `Nudge selected mesh UV ${direction}`
        : `Nudge selected mesh UV ${direction}: ${disabledLabel}`
    };
  });

const projectLastTopologyResultLabel = (state: EditorSemanticState): string => {
  const result = state.lastOperationResult;
  if (
    result === null ||
    (
      result.operationType !== "addMeshVertex" &&
      result.operationType !== "removeMeshVertex" &&
      result.operationType !== "addMeshTriangle" &&
      result.operationType !== "removeMeshTriangle" &&
      result.operationType !== "moveMeshUvPoint"
    )
  ) {
    return "No mesh topology or UV edit committed";
  }

  return `${result.operationType} ${result.status}`;
};

const formatTopologyBlockedReason = (
  reason: MeshTopologyDraftBlockedReason | null
): string | null => {
  switch (reason) {
    case null:
      return null;
    case "noMesh":
      return "No mesh selected";
    case "noEditableVertices":
      return "No editable vertices";
    case "locked":
      return "Locked";
    case "editorHidden":
      return "Editor hidden";
    case "noSelectedVertices":
      return "No selected vertices";
    case "requiresOneSelectedVertex":
      return "Select one unreferenced vertex";
    case "requiresThreeSelectedVertices":
      return "Select exactly three vertices";
    case "selectedVertexReferenced":
      return "Selected vertex is referenced by a triangle";
    case "triangleAlreadyExists":
      return "Triangle already exists for the selected vertices";
    case "missingTriangleStableId":
      return "Stable triangle ID required";
    case "invalidDelta":
      return "Invalid UV delta";
  }
};
