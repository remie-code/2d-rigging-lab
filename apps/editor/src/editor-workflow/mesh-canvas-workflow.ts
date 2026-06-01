import type { Vec2Dto } from "@private-2d-rigging-lab/contracts";

import type {
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import {
  createMeshCanvasDragDraftCommand,
  createMeshCanvasNudgeDraftCommand,
  hitTestMeshCanvasVertices,
  selectMeshCanvasHitTarget,
  selectMeshCanvasVertex,
  type MeshCanvasHitSelectionCommand,
  type MeshCanvasMoveDraftBlockedReason,
  type MeshCanvasMoveDraftSource,
  type MeshCanvasVertexSelectionCommand
} from "../editor-state/mesh-canvas-selection-state.js";
import {
  reprojectMeshEditState,
  type MeshEditState
} from "../editor-state/mesh-edit-state.js";
import {
  selectDrawableLayer,
  type EditorSemanticState
} from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";

export interface EditorWorkflowMeshCanvasSelectionResult {
  readonly status: "selected";
  readonly meshId: string | null;
  readonly selectedVertexIds: readonly string[];
}

export interface EditorWorkflowMeshCanvasMoveBlockedResult {
  readonly status: "blocked";
  readonly blockedReason: MeshCanvasMoveDraftBlockedReason;
  readonly selectedVertexIds: readonly string[];
}

export interface EditorWorkflowMeshCanvasMoveCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
  readonly selectedVertexIds: readonly string[];
}

export type EditorWorkflowMeshCanvasMoveResult =
  | EditorWorkflowMeshCanvasMoveBlockedResult
  | EditorWorkflowMeshCanvasMoveCommitResult;

export interface EditorWorkflowMeshCanvasMoveStateResult {
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
  readonly result: EditorWorkflowMeshCanvasMoveResult;
}

export const selectWorkflowMeshCanvasVertex = (input: {
  readonly state: EditorSemanticState;
  readonly command: MeshCanvasVertexSelectionCommand;
}): {
  readonly state: EditorSemanticState;
  readonly result: EditorWorkflowMeshCanvasSelectionResult;
} => {
  const hitTarget = input.state.meshEdit.canvasHitTargets.find(
    (target) => target.vertexId === input.command.vertexId.trim()
  );
  const meshEdit = selectMeshCanvasVertex(input.state.meshEdit, input.command);
  const state = projectCanvasSelectionState(input.state, meshEdit, hitTarget?.drawableId);

  return {
    state,
    result: createSelectionResult(state.meshEdit)
  };
};

export const selectWorkflowMeshCanvasHitTarget = (input: {
  readonly state: EditorSemanticState;
  readonly command: MeshCanvasHitSelectionCommand;
}): {
  readonly state: EditorSemanticState;
  readonly result: EditorWorkflowMeshCanvasSelectionResult;
} => {
  const hitTarget = hitTestMeshCanvasVertices(input.state.meshEdit, input.command.point, {
    ...(input.command.includeDisabledTargets === undefined
      ? {}
      : { includeDisabledTargets: input.command.includeDisabledTargets })
  });
  const meshEdit = selectMeshCanvasHitTarget(input.state.meshEdit, input.command);
  const state = projectCanvasSelectionState(input.state, meshEdit, hitTarget?.drawableId);

  return {
    state,
    result: createSelectionResult(state.meshEdit)
  };
};

export const commitWorkflowMeshCanvasMove = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly delta: Vec2Dto;
  readonly source: MeshCanvasMoveDraftSource;
}): EditorWorkflowMeshCanvasMoveStateResult => {
  const draft =
    input.source === "canvasDrag"
      ? createMeshCanvasDragDraftCommand(input.state.meshEdit, input.delta)
      : createMeshCanvasNudgeDraftCommand(input.state.meshEdit, input.delta);

  if (draft.status === "blocked" || draft.command === null) {
    return {
      state: input.state,
      latestSessionPersistenceResult: null,
      result: {
        status: "blocked",
        blockedReason: draft.blockedReason ?? "noSelectedVertices",
        selectedVertexIds: input.state.meshEdit.selectedVertexIds
      }
    };
  }

  const result = input.adapter.commitMoveMeshVertex({
    operationId: createMeshCanvasMoveOperationId(
      draft.command.source,
      draft.command.meshId,
      draft.command.selectedVertexIds,
      input.adapter.authoringSession.packageRevision
    ),
    meshId: draft.command.meshId,
    vertexDeltas: draft.command.vertexDeltas,
    lockedTargetIds: input.state.layerTreeDraft.lockedIds,
    intent: draft.command.intent
  });
  const state = applyEditorWorkflowCommitResult(input.state, input.adapter, result);

  return {
    state,
    latestSessionPersistenceResult: result,
    result: {
      status: result.operationResult.status === "committed" ? "committed" : "rejected",
      result,
      selectedVertexIds: draft.command.selectedVertexIds
    }
  };
};

const projectCanvasSelectionState = (
  state: EditorSemanticState,
  meshEdit: MeshEditState,
  selectedDrawableId: string | undefined
): EditorSemanticState => {
  if (selectedDrawableId === undefined) {
    return {
      ...state,
      meshEdit
    };
  }

  const layerTreeDraft = selectDrawableLayer(state.layerTreeDraft, selectedDrawableId);
  return {
    ...state,
    layerTreeDraft,
    meshEdit: reprojectMeshEditState(meshEdit, {
      layerTreeDraft,
      selectedVertexIds: meshEdit.selectedVertexIds
    })
  };
};

const createSelectionResult = (
  meshEdit: MeshEditState
): EditorWorkflowMeshCanvasSelectionResult => ({
  status: "selected",
  meshId: meshEdit.selectedMesh?.meshId ?? null,
  selectedVertexIds: meshEdit.selectedVertexIds
});

const createMeshCanvasMoveOperationId = (
  source: MeshCanvasMoveDraftSource,
  meshId: string,
  selectedVertexIds: readonly string[],
  packageRevision: number
): string =>
  [
    "op_editor_mesh_canvas",
    source === "canvasDrag" ? "drag" : "nudge",
    sanitizeOperationIdToken(meshId),
    sanitizeOperationIdToken(selectedVertexIds.join("_")),
    `r${packageRevision}`
  ].join("_");

const sanitizeOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
