import type {
  EditorBindRigControlChildCommand,
  EditorCreateRotation2dRigControlCommand,
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import type { EditorSemanticState } from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";

export type EditorWorkflowCreateRotation2dRigControlCommand =
  EditorCreateRotation2dRigControlCommand;
export type EditorWorkflowBindRigControlChildCommand =
  EditorBindRigControlChildCommand;

export interface EditorWorkflowRigControlCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
}

export interface EditorWorkflowRigControlCommitOutcome {
  readonly result: EditorWorkflowRigControlCommitResult;
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult;
}

export const commitWorkflowCreateRotation2dRigControl = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowCreateRotation2dRigControlCommand;
}): EditorWorkflowRigControlCommitOutcome => {
  const result = input.adapter.commitCreateRotation2dRigControl({
    ...input.command,
    operationId:
      input.command.operationId ??
      createRigControlOperationId(
        "create_rotation2d_rig_control",
        input.command.displayName,
        input.adapter.authoringSession.packageRevision
      )
  });

  return projectRigControlCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowBindRigControlChild = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowBindRigControlChildCommand;
}): EditorWorkflowRigControlCommitOutcome => {
  const result = input.adapter.commitBindRigControlChild({
    ...input.command,
    operationId:
      input.command.operationId ??
      createRigControlOperationId(
        "bind_rig_control_child",
        `${input.command.parentRigControlId}_${input.command.child.kind}_${input.command.child.id}`,
        input.adapter.authoringSession.packageRevision
      )
  });

  return projectRigControlCommitOutcome(input.state, input.adapter, result);
};

const projectRigControlCommitOutcome = (
  state: EditorSemanticState,
  adapter: EditorSessionAdapter,
  result: EditorSessionPersistenceResult
): EditorWorkflowRigControlCommitOutcome => ({
  latestSessionPersistenceResult: result,
  state: applyEditorWorkflowCommitResult(state, adapter, result),
  result: {
    status: result.operationResult.status === "committed" ? "committed" : "rejected",
    result
  }
});

const createRigControlOperationId = (
  operation: string,
  target: string,
  packageRevision: number
): string =>
  `op_editor_${operation}_${sanitizeRigControlOperationIdToken(target)}_r${packageRevision}`;

const sanitizeRigControlOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unnamed";
