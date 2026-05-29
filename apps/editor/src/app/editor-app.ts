import {
  createEditorSessionAdapter,
  type EditorCreateParameterCommand,
  type EditorSessionAdapter,
  type EditorSessionPersistenceResult
} from "../editor-session/index.js";
import {
  applyCommittedOperationSummary,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState,
  type EditorSemanticState
} from "../editor-state/index.js";
import { createEditorAppShell } from "../ui/app-shell/app-shell.js";

export function mountEditorApp(root: HTMLElement): void {
  const adapter = createEditorSessionAdapter();
  let state = createLoadedEditorState(adapter);
  let latestPersistenceResult: EditorSessionPersistenceResult | null = null;

  const render = (): void => {
    const viewModel = projectEditorWorkflowViewModel(state);

    root.replaceChildren(
      createEditorAppShell({
        state,
        viewModel,
        latestPersistenceResult,
        onCommitCreateParameter(command) {
          const result = adapter.commitCreateParameter(command);
          latestPersistenceResult = result;
          state = applyPersistenceResult(state, adapter, result);
          render();
        }
      })
    );
  };

  render();
}

const createLoadedEditorState = (adapter: EditorSessionAdapter): EditorSemanticState =>
  projectLoadedPackageState({
    identity: adapter.baseDocument.manifest,
    revision: {
      packageRevision: adapter.authoringSession.packageRevision,
      authoringRevision: adapter.authoringSession.authoringRevision
    },
    parameters: adapter.baseDocument.model.parameters.parameters
  });

const applyPersistenceResult = (
  state: EditorSemanticState,
  adapter: EditorSessionAdapter,
  result: EditorSessionPersistenceResult
): EditorSemanticState =>
  applyCommittedOperationSummary(state, {
    result: {
      ...result.operationResult,
      operationType: "createParameter"
    },
    operationLogEntries: result.operationLogEntries,
    generatedEvidence: {
      runtimeSnapshotIds: result.operationResult.generatedRuntimeSnapshotIds,
      runtimeStateArtifactPaths: result.evidence.generatedRuntimeStateRefs,
      runtimeStateSequenceArtifactPaths: result.evidence.generatedRuntimeStateSequenceRefs,
      validationReportIds: result.evidence.generatedValidationReportIds,
      validationReportArtifactPaths: result.evidence.validationArtifactPaths
    },
    revision: {
      packageRevision: result.packageRevisionAfterCommit,
      authoringRevision: adapter.authoringSession.authoringRevision
    },
    parameters: result.reloadedDocument.model.parameters.parameters,
    reload: {
      status: result.operationResult.status === "committed" ? "reloaded" : "failed",
      packageRevision: result.reloadedPackageRevision,
      parameterIds: result.parameterIdsAfterReload,
      filePaths: result.packageFilePaths
    }
  });
