import type { EditorSemanticState } from "./editor-semantic-state.js";
import type { AiTranscriptSummaryEntryState } from "./ai-transcript-summary.js";
import {
  isPreviewParameterDisabled,
  type PreviewParameterValueState
} from "./preview-parameter-state.js";

export interface AiApprovalWorkflowViewModel {
  readonly status: EditorSemanticState["aiApproval"]["status"];
  readonly latestDryRunCommandId: string | null;
  readonly latestDryRunOperationId: string | null;
  readonly latestDryRunResultLabel: string;
  readonly canApproveLatestDryRun: boolean;
  readonly canCommitApprovedOperation: boolean;
  readonly canRejectPendingDryRun: boolean;
  readonly transcriptEntries: readonly AiTranscriptSummaryEntryState[];
}

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
  readonly previewControls: EditorPreviewControlsViewModel;
  readonly aiApproval: AiApprovalWorkflowViewModel;
}

export interface PreviewParameterControlViewModel {
  readonly parameterId: string;
  readonly displayName: string;
  readonly valueSource: PreviewParameterValueState["valueSource"];
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly currentValue: number;
  readonly recommendedUiStep: number;
  readonly disabled: boolean;
  readonly label: string;
  readonly valueLabel: string;
  readonly rangeLabel: string;
  readonly defaultValueLabel: string;
  readonly disabledMessage: string | null;
}

export interface EditorPreviewControlsViewModel {
  readonly hasParameters: boolean;
  readonly parameterCountLabel: string;
  readonly resetLabel: string;
  readonly emptyMessage: string;
  readonly authoredInputCount: number;
  readonly parameterControls: readonly PreviewParameterControlViewModel[];
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
    reloadLabel: projectReloadLabel(state),
    previewControls: projectPreviewControlsViewModel(state),
    aiApproval: projectAiApprovalViewModel(state)
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

const projectAiApprovalViewModel = (
  state: EditorSemanticState
): AiApprovalWorkflowViewModel => ({
  status: state.aiApproval.status,
  latestDryRunCommandId: state.aiApproval.latestDryRunCommandId,
  latestDryRunOperationId: state.aiApproval.latestDryRunOperationId,
  latestDryRunResultLabel:
    state.aiApproval.latestDryRunResult === null
      ? "No AI dry-run pending"
      : `${state.aiApproval.latestDryRunResult.operationType} ${state.aiApproval.latestDryRunResult.status}`,
  canApproveLatestDryRun: state.aiApproval.canApproveLatestDryRun,
  canCommitApprovedOperation: state.aiApproval.canCommitApprovedOperation,
  canRejectPendingDryRun: state.aiApproval.canRejectPendingDryRun,
  transcriptEntries: state.aiApproval.transcriptEntries
});

const projectPreviewControlsViewModel = (
  state: EditorSemanticState
): EditorPreviewControlsViewModel => {
  const parameterControls = state.previewParameters.map(projectPreviewParameterControl);
  const authoredInputCount = parameterControls.filter((parameter) => !parameter.disabled).length;

  return {
    hasParameters: parameterControls.length > 0,
    parameterCountLabel: `${parameterControls.length} preview parameter${parameterControls.length === 1 ? "" : "s"}`,
    resetLabel: "Reset preview parameters",
    emptyMessage:
      state.loadedPackage === null
        ? "No package loaded"
        : "No preview parameters available",
    authoredInputCount,
    parameterControls
  };
};

const projectPreviewParameterControl = (
  parameter: PreviewParameterValueState
): PreviewParameterControlViewModel => {
  const disabled = isPreviewParameterDisabled(parameter);

  return {
    parameterId: parameter.parameterId,
    displayName: parameter.displayName,
    valueSource: parameter.valueSource,
    min: parameter.min,
    max: parameter.max,
    defaultValue: parameter.defaultValue,
    currentValue: parameter.currentValue,
    recommendedUiStep: parameter.recommendedUiStep,
    disabled,
    label: parameter.displayName,
    valueLabel: `${parameter.displayName}: ${formatPreviewNumber(parameter.currentValue)}`,
    rangeLabel: `${formatPreviewNumber(parameter.min)} to ${formatPreviewNumber(parameter.max)}`,
    defaultValueLabel: `Default ${formatPreviewNumber(parameter.defaultValue)}`,
    disabledMessage: disabled
      ? `Preview control disabled for ${parameter.valueSource} parameter`
      : null
  };
};

const formatPreviewNumber = (value: number): string =>
  Number.isInteger(value) ? `${value}` : Number.parseFloat(value.toFixed(4)).toString();
