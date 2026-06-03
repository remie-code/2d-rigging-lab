import type {
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import type {
  EditorSemanticState,
  MeshTopologyAddTriangleDraftCommand,
  MeshTopologyAddVertexDraftCommand,
  MeshTopologyRemoveTriangleDraftCommand,
  MeshTopologyRemoveVertexDraftCommand,
  MeshUvNudgeDraftCommand
} from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";

export interface EditorWorkflowMeshTopologyCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
  readonly selectedVertexIds: readonly string[];
}

export interface EditorWorkflowMeshTopologyStateResult {
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult;
  readonly result: EditorWorkflowMeshTopologyCommitResult;
}

export const commitWorkflowAddMeshVertex = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: MeshTopologyAddVertexDraftCommand;
}): EditorWorkflowMeshTopologyStateResult => {
  const result = input.adapter.commitAddMeshVertex({
    operationId: createMeshTopologyOperationId(
      "add_vertex",
      input.command.meshId,
      [input.command.vertexId],
      input.adapter.authoringSession.packageRevision
    ),
    meshId: input.command.meshId,
    vertexId: input.command.vertexId,
    position: input.command.position,
    uv: input.command.uv,
    expectedTopologyRevision: input.command.expectedTopologyRevision,
    lockedTargetIds: input.state.layerTreeDraft.lockedIds,
    intent: input.command.intent
  });

  return projectMeshTopologyCommitResult(input.state, input.adapter, result);
};

export const commitWorkflowRemoveMeshVertex = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: MeshTopologyRemoveVertexDraftCommand;
}): EditorWorkflowMeshTopologyStateResult => {
  const result = input.adapter.commitRemoveMeshVertex({
    operationId: createMeshTopologyOperationId(
      "remove_vertex",
      input.command.meshId,
      [input.command.vertexId],
      input.adapter.authoringSession.packageRevision
    ),
    meshId: input.command.meshId,
    vertexId: input.command.vertexId,
    expectedTopologyRevision: input.command.expectedTopologyRevision,
    lockedTargetIds: input.state.layerTreeDraft.lockedIds,
    intent: input.command.intent
  });

  return projectMeshTopologyCommitResult(input.state, input.adapter, result);
};

export const commitWorkflowAddMeshTriangle = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: MeshTopologyAddTriangleDraftCommand;
}): EditorWorkflowMeshTopologyStateResult => {
  const result = input.adapter.commitAddMeshTriangle({
    operationId: createMeshTopologyOperationId(
      "add_triangle",
      input.command.meshId,
      [input.command.triangleId, ...input.command.vertexIds],
      input.adapter.authoringSession.packageRevision
    ),
    meshId: input.command.meshId,
    triangleId: input.command.triangleId,
    vertexIds: input.command.vertexIds,
    expectedTopologyRevision: input.command.expectedTopologyRevision,
    lockedTargetIds: input.state.layerTreeDraft.lockedIds,
    intent: input.command.intent
  });

  return projectMeshTopologyCommitResult(input.state, input.adapter, result);
};

export const commitWorkflowRemoveMeshTriangle = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: MeshTopologyRemoveTriangleDraftCommand;
}): EditorWorkflowMeshTopologyStateResult => {
  const result = input.adapter.commitRemoveMeshTriangle({
    operationId: createMeshTopologyOperationId(
      "remove_triangle",
      input.command.meshId,
      [input.command.triangleId],
      input.adapter.authoringSession.packageRevision
    ),
    meshId: input.command.meshId,
    triangleId: input.command.triangleId,
    expectedTopologyRevision: input.command.expectedTopologyRevision,
    lockedTargetIds: input.state.layerTreeDraft.lockedIds,
    intent: input.command.intent
  });

  return projectMeshTopologyCommitResult(input.state, input.adapter, result);
};

export const commitWorkflowMoveMeshUvPoint = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: MeshUvNudgeDraftCommand;
}): EditorWorkflowMeshTopologyStateResult => {
  const result = input.adapter.commitMoveMeshUvPoint({
    operationId: createMeshTopologyOperationId(
      "move_uv",
      input.command.meshId,
      input.command.selectedVertexIds,
      input.adapter.authoringSession.packageRevision
    ),
    meshId: input.command.meshId,
    uvDeltas: input.command.uvDeltas,
    expectedTopologyRevision: input.command.expectedTopologyRevision,
    lockedTargetIds: input.state.layerTreeDraft.lockedIds,
    intent: input.command.intent
  });

  return projectMeshTopologyCommitResult(input.state, input.adapter, result);
};

const projectMeshTopologyCommitResult = (
  state: EditorSemanticState,
  adapter: EditorSessionAdapter,
  result: EditorSessionPersistenceResult
): EditorWorkflowMeshTopologyStateResult => {
  const projectedState = applyEditorWorkflowCommitResult(state, adapter, result);

  return {
    state: projectedState,
    latestSessionPersistenceResult: result,
    result: {
      status: result.operationResult.status === "committed" ? "committed" : "rejected",
      result,
      selectedVertexIds: projectedState.meshEdit.selectedVertexIds
    }
  };
};

const createMeshTopologyOperationId = (
  operation: "add_vertex" | "remove_vertex" | "add_triangle" | "remove_triangle" | "move_uv",
  meshId: string,
  targetIds: readonly string[],
  packageRevision: number
): string =>
  [
    "op_editor_mesh_topology",
    operation,
    sanitizeOperationIdToken(meshId),
    sanitizeOperationIdToken(targetIds.join("_")),
    `r${packageRevision}`
  ].join("_");

const sanitizeOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
