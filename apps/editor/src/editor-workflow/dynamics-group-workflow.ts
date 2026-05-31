import type {
  EditorCreateDynamicsGroupCommand,
  EditorSessionAdapter,
  EditorSessionPersistenceResult,
  EditorUpdateDynamicsGroupCommand
} from "../editor-session/index.js";
import {
  createEmptyDynamicsPreviewState,
  type EditorSemanticState
} from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";

export type EditorWorkflowCreateDynamicsGroupCommand =
  Omit<EditorCreateDynamicsGroupCommand, "outputParameterId"> & {
    readonly outputParameterDisplayName?: string;
    readonly outputParameterId?: string;
    readonly outputParameterOperationId?: string;
  };

export interface EditorWorkflowDynamicsCreateResult {
  readonly status: "committed" | "rejected";
  readonly outputParameterResult: EditorSessionPersistenceResult | null;
  readonly dynamicsGroupResult: EditorSessionPersistenceResult | null;
}

export interface EditorWorkflowDynamicsUpdateResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
}

export interface EditorWorkflowDynamicsCommitOutcome<T> {
  readonly result: T;
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult;
}

export const commitWorkflowCreateDynamicsGroup = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowCreateDynamicsGroupCommand;
}): EditorWorkflowDynamicsCommitOutcome<EditorWorkflowDynamicsCreateResult> => {
  const { adapter, command } = input;
  let state = input.state;
  let outputParameterResult: EditorSessionPersistenceResult | null = null;
  let outputParameterId = command.outputParameterId;

  if (outputParameterId === undefined || outputParameterId.trim().length === 0) {
    outputParameterId = createDynamicsOutputParameterId(
      command.outputParameterDisplayName ?? command.displayName,
      adapter.authoringSession.packageRevision
    );
    outputParameterResult = adapter.commitCreateParameter({
      operationId:
        command.outputParameterOperationId ??
        createDynamicsOperationId(
          "create_dynamics_output_parameter",
          outputParameterId,
          adapter.authoringSession.packageRevision
        ),
      parameterId: outputParameterId,
      displayName: command.outputParameterDisplayName ?? `${command.displayName} Output`,
      semanticRole: "dynamics",
      projectPresetAlias: `private-open-dynamics-${sanitizeDynamicsOperationIdToken(outputParameterId)}`,
      valueSource: "computedDynamics",
      min: command.outputMin,
      max: command.outputMax,
      defaultValue: 0,
      recommendedUiStep: 0.01
    });
    state = clearDynamicsPreviewState(
      applyEditorWorkflowCommitResult(state, adapter, outputParameterResult)
    );

    if (outputParameterResult.operationResult.status !== "committed") {
      return {
        state,
        latestSessionPersistenceResult: outputParameterResult,
        result: {
          status: "rejected",
          outputParameterResult,
          dynamicsGroupResult: null
        }
      };
    }
  }

  const dynamicsGroupResult = adapter.commitCreateDynamicsGroup({
    ...command,
    outputParameterId,
    operationId:
      command.operationId ??
      createDynamicsOperationId(
        "create_dynamics_group",
        command.displayName,
        adapter.authoringSession.packageRevision
      )
  });
  state = clearDynamicsPreviewState(
    applyEditorWorkflowCommitResult(state, adapter, dynamicsGroupResult)
  );

  return {
    state,
    latestSessionPersistenceResult: dynamicsGroupResult,
    result: {
      status: dynamicsGroupResult.operationResult.status === "committed" ? "committed" : "rejected",
      outputParameterResult,
      dynamicsGroupResult
    }
  };
};

export const commitWorkflowUpdateDynamicsGroup = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorUpdateDynamicsGroupCommand;
}): EditorWorkflowDynamicsCommitOutcome<EditorWorkflowDynamicsUpdateResult> => {
  const { adapter, command } = input;
  const result = adapter.commitUpdateDynamicsGroup({
    ...command,
    operationId:
      command.operationId ??
      createDynamicsOperationId(
        "update_dynamics_group",
        command.dynamicsGroupId,
        adapter.authoringSession.packageRevision
      )
  });

  return {
    state: clearDynamicsPreviewState(
      applyEditorWorkflowCommitResult(input.state, adapter, result)
    ),
    latestSessionPersistenceResult: result,
    result: {
      status: result.operationResult.status === "committed" ? "committed" : "rejected",
      result
    }
  };
};

const clearDynamicsPreviewState = (state: EditorSemanticState): EditorSemanticState => ({
  ...state,
  dynamicsPreview: createEmptyDynamicsPreviewState()
});

const createDynamicsOperationId = (
  operation: string,
  target: string,
  packageRevision: number
): string =>
  `op_editor_${operation}_${sanitizeDynamicsOperationIdToken(target)}_r${packageRevision}`;

const createDynamicsOutputParameterId = (
  displayName: string,
  packageRevision: number
): string =>
  `param_dynamics_${sanitizeDynamicsOperationIdToken(displayName)}_r${packageRevision}`;

const sanitizeDynamicsOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
