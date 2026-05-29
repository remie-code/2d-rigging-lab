import type { AiEditorState } from "@private-2d-rigging-lab/ai-interface";

import type { EditorSemanticState } from "../editor-state/index.js";

export const projectEditorAiState = (
  state: EditorSemanticState,
  detail: "summary" | "full"
): AiEditorState => ({
  ...state,
  packageRevision: state.revision.packageRevision,
  authoringRevision: state.revision.authoringRevision,
  detail,
  mode: "select",
  activeToolId: "select",
  selection: [],
  lockedIds: [],
  editorHiddenIds: [],
  currentPreviewParameterValues: {},
  currentDynamicsPreviewGroupIds: [],
  canvasViewport: {
    canvasRectCssPx: { x: 0, y: 0, width: 0, height: 0 },
    modelBounds: { x: 0, y: 0, width: 0, height: 0 },
    zoom: 1,
    pan: { x: 0, y: 0 },
    coordinateSystem: "canvas-y-down-v1"
  },
  lastOperationId: state.operationLog.latestEntry?.operationId
});
