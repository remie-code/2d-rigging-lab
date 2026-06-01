import type {
  EditorAddDrawableOpacityKeyformCommand,
  EditorSessionAdapter,
  EditorSessionPersistenceResult,
  EditorSetMaskRelationCommand
} from "../editor-session/index.js";
import type { EditorSemanticState } from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";

export type EditorWorkflowSetMaskRelationCommand = EditorSetMaskRelationCommand;
export type EditorWorkflowAddDrawableOpacityKeyformCommand =
  EditorAddDrawableOpacityKeyformCommand;

export interface EditorWorkflowCompositionCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
}

export interface EditorWorkflowCompositionCommitOutcome {
  readonly result: EditorWorkflowCompositionCommitResult;
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult;
}

export const commitWorkflowSetMaskRelation = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowSetMaskRelationCommand;
}): EditorWorkflowCompositionCommitOutcome => {
  const result = input.adapter.commitSetMaskRelation({
    ...input.command,
    operationId:
      input.command.operationId ??
      createCompositionOperationId(
        "set_mask_relation",
        [
          input.command.maskRelationId ?? "auto",
          ...input.command.maskDrawableIds,
          ...input.command.targetDrawableIds,
          input.command.enabled ? "enabled" : "disabled"
        ].join("_"),
        input.adapter.authoringSession.packageRevision
      )
  });

  return projectCompositionCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowAddDrawableOpacityKeyform = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowAddDrawableOpacityKeyformCommand;
}): EditorWorkflowCompositionCommitOutcome => {
  const result = input.adapter.commitAddDrawableOpacityKeyform({
    ...input.command,
    operationId:
      input.command.operationId ??
      createCompositionOperationId(
        "add_drawable_opacity_keyform",
        `${input.command.drawableId}_${input.command.parameterId}_${input.command.keyValue}`,
        input.adapter.authoringSession.packageRevision
      )
  });

  return projectCompositionCommitOutcome(input.state, input.adapter, result);
};

const projectCompositionCommitOutcome = (
  state: EditorSemanticState,
  adapter: EditorSessionAdapter,
  result: EditorSessionPersistenceResult
): EditorWorkflowCompositionCommitOutcome => ({
  latestSessionPersistenceResult: result,
  state: applyEditorWorkflowCommitResult(state, adapter, result),
  result: {
    status: result.operationResult.status === "committed" ? "committed" : "rejected",
    result
  }
});

const createCompositionOperationId = (
  operation: string,
  target: string,
  packageRevision: number
): string =>
  `op_editor_${operation}_${sanitizeCompositionOperationIdToken(target)}_r${packageRevision}`;

const sanitizeCompositionOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unnamed";
