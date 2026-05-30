import {
  editorTestIds,
  type EditorSemanticState,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";
import type { EditorPreviewProjectionDto } from "../../editor-preview/preview-dto.js";
import type {
  EditorDrawableLayerMoveDirection,
  EditorWorkflowPersistenceResult
} from "../../editor-workflow/index.js";
import type {
  EditorCreateDrawablePresetCommand,
  EditorMeshVertexNudgeCommand,
  EditorCreateParameterCommand,
  EditorSessionPersistenceResult
} from "../../editor-session/index.js";
import {
  createGeneratedEvidenceSummaryPanel,
  createOperationLogSummaryPanel
} from "../evidence-panel/index.js";
import { createAiApprovalPanel, type AiApprovalPanelCallback } from "../ai-approval/index.js";
import { createAiTranscriptPanel } from "../ai-transcript/index.js";
import { createDrawableAuthoringPanel } from "../drawable-authoring/index.js";
import {
  createPackageFileSetPanel,
  createReloadSummaryPanel
} from "../package-file-set/index.js";
import { createCreateParameterForm } from "../parameter-operation/create-parameter-form.js";
import { createOperationStatusPanel } from "../parameter-operation/operation-status-panel.js";
import { createParameterList } from "../parameter-operation/parameter-list.js";
import { createPreviewPanel } from "../preview-panel/index.js";
import { createProjectPersistencePanel } from "../project-persistence/index.js";
import { createPackageStatus } from "./package-status.js";

export interface EditorAppShellOptions {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly previewProjection: EditorPreviewProjectionDto | null;
  readonly latestPersistenceResult: EditorSessionPersistenceResult | null;
  readonly latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null;
  readonly onCommitCreateParameter: (command: EditorCreateParameterCommand) => void;
  readonly onCommitCreateDrawablePreset: (command: EditorCreateDrawablePresetCommand) => void;
  readonly onToggleDrawableRuntimeVisibility: (drawableId: string) => void;
  readonly onMoveDrawableLayer: (drawableId: string, direction: EditorDrawableLayerMoveDirection) => void;
  readonly onNudgeMeshVertex: (command: EditorMeshVertexNudgeCommand) => void;
  readonly onSaveProject: () => void;
  readonly onLoadProject: () => void;
  readonly onResetProject: () => void;
  readonly onSetPreviewParameterValue: (parameterId: string, value: number) => void;
  readonly onResetPreviewParameterValues: () => void;
  readonly onDryRunAiCreateParameter: AiApprovalPanelCallback;
  readonly onApproveLatestAiDryRun: AiApprovalPanelCallback;
  readonly onRejectLatestAiDryRun: AiApprovalPanelCallback;
  readonly onCommitApprovedAiOperation: AiApprovalPanelCallback;
}

export const createEditorAppShell = (options: EditorAppShellOptions): HTMLElement => {
  const shell = document.createElement("main");
  shell.className = "editor-shell";
  shell.dataset.testid = editorTestIds.shell;

  const appBar = document.createElement("header");
  appBar.className = "editor-app-bar";

  const titleGroup = document.createElement("div");
  titleGroup.className = "editor-title-group";

  const title = document.createElement("h1");
  title.textContent = "2D Rigging Editor";

  const workflowStatus = document.createElement("p");
  workflowStatus.className = "editor-workflow-status";
  workflowStatus.textContent = options.viewModel.isPackageLoaded
    ? "Operation persistence slice"
    : "Waiting for package";

  titleGroup.append(title, workflowStatus);
  appBar.append(titleGroup, createPackageStatus(options.state, options.viewModel));

  const workspace = document.createElement("section");
  workspace.className = "editor-workspace";
  workspace.setAttribute("aria-label", "Editor workspace");

  const parametersPanel = document.createElement("section");
  parametersPanel.className = "editor-panel editor-panel--parameters";
  parametersPanel.setAttribute("aria-labelledby", "editor-parameters-heading");

  const parametersHeading = document.createElement("h2");
  parametersHeading.id = "editor-parameters-heading";
  parametersHeading.textContent = "Parameters";

  const parameterCount = document.createElement("p");
  parameterCount.className = "editor-panel__meta";
  parameterCount.textContent = options.viewModel.parameterCountLabel;

  parametersPanel.append(
    parametersHeading,
    parameterCount,
    createParameterList(options.state.parameters)
  );

  const operationPanel = document.createElement("section");
  operationPanel.className = "editor-panel editor-panel--operation";
  operationPanel.setAttribute("aria-labelledby", "editor-create-parameter-heading");

  const operationHeading = document.createElement("h2");
  operationHeading.id = "editor-create-parameter-heading";
  operationHeading.textContent = "Create Parameter";

  operationPanel.append(
    operationHeading,
    createCreateParameterForm({
      disabled: !options.viewModel.canSubmitCreateParameter,
      draft: options.state.pendingCreateParameter,
      onSubmit: options.onCommitCreateParameter
    }),
    createOperationStatusPanel(options.state, options.viewModel)
  );
  const drawableAuthoringPanel = createDrawableAuthoringPanel({
    state: options.state,
    viewModel: options.viewModel,
    onCommitCreateDrawable: options.onCommitCreateDrawablePreset,
    onToggleDrawableRuntimeVisibility: options.onToggleDrawableRuntimeVisibility,
    onMoveDrawableLayer: options.onMoveDrawableLayer,
    onNudgeMeshVertex: options.onNudgeMeshVertex
  });
  const previewPanel = createPreviewPanel({
    viewModel: options.viewModel,
    preview: options.previewProjection,
    onSetPreviewParameterValue: options.onSetPreviewParameterValue,
    onResetPreviewParameterValues: options.onResetPreviewParameterValues
  });
  const projectPersistencePanel = createProjectPersistencePanel({
    viewModel: options.viewModel,
    latestProjectPersistenceResult: options.latestProjectPersistenceResult,
    onSaveProject: options.onSaveProject,
    onLoadProject: options.onLoadProject,
    onResetProject: options.onResetProject
  });
  const aiApprovalPanel = createAiApprovalPanel({
    viewModel: options.viewModel,
    onDryRunCreateParameter: options.onDryRunAiCreateParameter,
    onApproveLatestDryRun: options.onApproveLatestAiDryRun,
    onRejectPendingDryRun: options.onRejectLatestAiDryRun,
    onCommitApprovedOperation: options.onCommitApprovedAiOperation
  });
  const aiTranscriptPanel = createAiTranscriptPanel({
    entries: options.viewModel.aiApproval.transcriptEntries
  });

  const persistencePanel = document.createElement("section");
  persistencePanel.className = "editor-persistence-grid";
  persistencePanel.setAttribute("aria-label", "Operation persistence evidence");

  persistencePanel.append(
    createOperationLogSummaryPanel(options.state.operationLog),
    createGeneratedEvidenceSummaryPanel(options.state.generatedEvidence),
    createPackageFileSetPanel({
      packageFilePaths: options.state.reload.filePaths,
      generatedArtifactPaths: options.latestPersistenceResult?.generatedArtifactPaths ?? []
    }),
    createReloadSummaryPanel(options.state.reload)
  );

  workspace.append(
    parametersPanel,
    previewPanel,
    operationPanel,
    drawableAuthoringPanel,
    projectPersistencePanel,
    aiApprovalPanel,
    aiTranscriptPanel,
    persistencePanel
  );
  shell.append(appBar, workspace);

  return shell;
};
