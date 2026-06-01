import type { EditorStateFileDto } from "@private-2d-rigging-lab/package-format";

import type { EditorSemanticState } from "./editor-semantic-state.js";

export const createEditorStateFileFromEditorState = (
  state: Pick<EditorSemanticState, "layerTreeDraft" | "meshEdit">
): EditorStateFileDto => {
  const selectedMeshVertexIds = state.meshEdit.selectedVertexIds;
  const isMeshEditSelection = selectedMeshVertexIds.length > 0;

  return {
    schemaVersion: "editor-state-v1",
    selection: isMeshEditSelection
      ? [...selectedMeshVertexIds]
      : [...state.layerTreeDraft.selection],
    lockedIds: [...state.layerTreeDraft.lockedIds],
    editorHiddenIds: [...state.layerTreeDraft.editorHiddenIds],
    ...(isMeshEditSelection ? { activeTool: "meshEdit" } : {})
  };
};

export const projectMeshSelectedVertexIdsFromEditorState = (
  editorState: Pick<EditorStateFileDto, "selection" | "activeTool"> | undefined
): readonly string[] => editorState?.activeTool === "meshEdit" ? editorState.selection : [];
