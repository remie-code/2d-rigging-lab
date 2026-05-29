import type { EditorSemanticState } from "./editor-semantic-state.js";

export interface EditorWorkflowViewModel {
  readonly packageTitle: string;
  readonly packageRevisionLabel: string;
  readonly isPackageLoaded: boolean;
  readonly parameterCountLabel: string;
  readonly canSubmitCreateParameter: boolean;
  readonly lastOperationLabel: string;
  readonly operationLogLabel: string;
  readonly generatedEvidenceLabel: string;
  readonly reloadLabel: string;
}

export const projectEditorWorkflowViewModel = (
  state: EditorSemanticState
): EditorWorkflowViewModel => {
  const runtimeArtifactCount =
    state.generatedEvidence.runtimeSnapshotIds.length +
    state.generatedEvidence.runtimeStateArtifactPaths.length +
    state.generatedEvidence.runtimeStateSequenceArtifactPaths.length;
  const validationArtifactCount =
    state.generatedEvidence.validationReportIds.length +
    state.generatedEvidence.validationReportArtifactPaths.length;

  return {
    packageTitle: state.loadedPackage?.displayName ?? "No package loaded",
    packageRevisionLabel: `Package r${state.revision.packageRevision} / authoring r${state.revision.authoringRevision}`,
    isPackageLoaded: state.loadedPackage !== null,
    parameterCountLabel: `${state.parameters.length} parameter${state.parameters.length === 1 ? "" : "s"}`,
    canSubmitCreateParameter: state.loadedPackage !== null && state.pendingCreateParameter.status !== "submitting",
    lastOperationLabel: projectLastOperationLabel(state),
    operationLogLabel: `${state.operationLog.entryCount} operation${state.operationLog.entryCount === 1 ? "" : "s"}`,
    generatedEvidenceLabel: `${runtimeArtifactCount} runtime / ${validationArtifactCount} validation artifacts`,
    reloadLabel: projectReloadLabel(state)
  };
};

const projectLastOperationLabel = (state: EditorSemanticState): string => {
  if (state.lastOperationResult === null) {
    return "No operation committed";
  }

  return `${state.lastOperationResult.operationType} ${state.lastOperationResult.status}`;
};

const projectReloadLabel = (state: EditorSemanticState): string => {
  if (state.reload.status === "not_reloaded") {
    return "Not reloaded";
  }

  if (state.reload.status === "failed") {
    return "Reload failed";
  }

  return `Reloaded r${state.reload.packageRevision} with ${state.reload.parameterCount} parameter${state.reload.parameterCount === 1 ? "" : "s"}`;
};
