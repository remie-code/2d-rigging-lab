import {
  editorTestIds,
  type EditorSemanticState,
  type EditorWorkflowViewModel,
  type ExplicitPsdImportTaskObservationState,
  type LayerTreeDrawablePartAssignmentDraftCommand,
  type LayerTreeDrawableTextureAssignmentDraftCommand,
  type LayerTreeEmptyLeafPartDeleteDraftCommand,
  type LayerTreePartRenameDraftCommand,
  type LayerTreePartReparentDraftCommand,
  type MeshCanvasVertexSelectionCommand,
  type MeshTopologyAddTriangleDraftCommand,
  type MeshTopologyAddVertexDraftCommand,
  type MeshTopologyRemoveTriangleDraftCommand,
  type MeshTopologyRemoveVertexDraftCommand,
  type MeshUvNudgeDraftCommand,
  type SourceIntakeSelectedFileBytes,
  type TutorialSelectedTargetState,
  projectExplicitPsdImportTaskObservation
} from "../../editor-state/index.js";
import { applyEditorPreviewTextureAssets } from "../../editor-preview/texture-preview-resolution.js";
import type { EditorPreviewProjectionDto } from "../../editor-preview/preview-dto.js";
import {
  parsePackageDocumentFromFileSet,
  type TextureAtlasFileDto
} from "@private-2d-rigging-lab/package-format";
import type {
  EditorDrawableLayerMoveDirection,
  EditorWorkflowAddDrawableOpacityKeyformCommand,
  EditorWorkflowAddWarpLattice2dControlPointOffsetsKeyformCommand,
  EditorWorkflowBindRigControlChildCommand,
  EditorWorkflowBindWarpLattice2dChildCommand,
  EditorWorkflowCreateWarpLattice2dRigControlCommand,
  EditorWorkflowCreateRotation2dRigControlCommand,
  EditorViewerRuntimeProjection,
  EditorWorkflowSetMaskRelationCommand,
  EditorWorkflowPersistenceResult,
  EditorExplicitPsdImportFileCommand,
  EditorExplicitPsdImportPlanApprovedBatchIntakeCommand,
  EditorExplicitPsdImportPlanPreviewCommand,
  EditorExplicitPsdStructuralScaffoldCommitCommand,
  EditorExplicitPsdStructuralScaffoldPreviewCommand,
  EditorExplicitPsdLayerBatchIntakeCommand,
  EditorExplicitPsdLayerIntakeCommand
} from "../../editor-workflow/index.js";
import type {
  EditorCreateDrawablePresetCommand,
  EditorCreatePartCommand,
  EditorMeshVertexNudgeCommand,
  EditorCreateParameterCommand,
  EditorSessionPersistenceResult,
  EditorSetDrawablePartCommand,
  EditorSetDrawableTextureCommand,
  EditorUpdateDynamicsGroupCommand,
  EditorUpdatePartCommand
} from "../../editor-session/index.js";
import {
  createGeneratedEvidenceSummaryPanel,
  createOperationLogSummaryPanel
} from "../evidence-panel/index.js";
import { createAiApprovalPanel, type AiApprovalPanelCallback } from "../ai-approval/index.js";
import { createAiTranscriptPanel } from "../ai-transcript/index.js";
import { createDrawableAuthoringPanel } from "../drawable-authoring/index.js";
import { createCompositionPanel } from "../composition-panel/index.js";
import {
  createDynamicsPanel,
  type EditorDynamicsCreateCommand
} from "../dynamics-panel/index.js";
import {
  createCodexProposalReviewPanel,
  type CodexProposalReviewPanelCallback
} from "../codex-proposal-review/index.js";
import {
  createPackageFileSetPanel,
  createReloadSummaryPanel
} from "../package-file-set/index.js";
import { createCreateParameterForm } from "../parameter-operation/create-parameter-form.js";
import { createOperationStatusPanel } from "../parameter-operation/operation-status-panel.js";
import { createParameterList } from "../parameter-operation/parameter-list.js";
import { createPreviewPanel } from "../preview-panel/index.js";
import { createProductPreflightPanel } from "../product-preflight/index.js";
import { createProjectPersistencePanel } from "../project-persistence/index.js";
import {
  createExplicitPsdImportTaskContent,
  type ExplicitPsdImportTaskContentOptions
} from "../explicit-psd-import/index.js";
import { createRigControlPanel } from "../rig-control-panel/index.js";
import { createSourceIntakePanel } from "../source-assets/index.js";
import { createTutorialWorkflowPanel } from "../tutorial-workflow/index.js";
import { createViewerRuntimePanel } from "../viewer-runtime/index.js";
import {
  createAuthoringToolboxSurface,
  createAuthoringWorkspacePrimaryLayout,
  createCanvasPreviewRegion,
  createPartsTreeShellSurface,
  createWorkspaceDiagnosticsStripShellSurface,
  createWorkspaceInspectorShellSurface,
  createWorkspaceParameterBarShellSurface,
  createWorkspaceSupportRegion
} from "./authoring-workspace-v0-shell.js";
import { createPackageStatus } from "./package-status.js";
import { applyShellSurfaceMetadata, shellSurfaces } from "./shell-surfaces.js";
import { createTaskShell } from "./task-shell.js";

export type EditorAppShellActiveTask = "psdImport" | null;

export interface EditorAppShellOptions {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly previewProjection: EditorPreviewProjectionDto | null;
  readonly viewerRuntimeProjection: EditorViewerRuntimeProjection | null;
  readonly latestPersistenceResult: EditorSessionPersistenceResult | null;
  readonly latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null;
  readonly activeTask?: EditorAppShellActiveTask;
  readonly onOpenPsdImportTask?: () => void;
  readonly onCloseActiveTask?: () => void;
  readonly onCommitCreateParameter: (command: EditorCreateParameterCommand) => void;
  readonly onCommitCreateDrawablePreset: (command: EditorCreateDrawablePresetCommand) => void;
  readonly onCommitCreatePart: (command: EditorCreatePartCommand) => void;
  readonly onCommitUpdatePart: (command: EditorUpdatePartCommand) => void;
  readonly onCommitSetDrawablePart: (command: EditorSetDrawablePartCommand) => void;
  readonly onCommitSetDrawableTexture: (command: EditorSetDrawableTextureCommand) => void;
  readonly onDraftLayerTreePartRename?: (command: LayerTreePartRenameDraftCommand) => void;
  readonly onDraftLayerTreePartReparent?: (command: LayerTreePartReparentDraftCommand) => void;
  readonly onDraftLayerTreeEmptyLeafPartDelete?: (
    command: LayerTreeEmptyLeafPartDeleteDraftCommand
  ) => void;
  readonly onDraftLayerTreeDrawablePartAssignment?: (
    command: LayerTreeDrawablePartAssignmentDraftCommand
  ) => void;
  readonly onDraftLayerTreeDrawableTextureAssignment?: (
    command: LayerTreeDrawableTextureAssignmentDraftCommand
  ) => void;
  readonly onCommitLayerTreeDirectManipulationDrafts?: () => void;
  readonly onClearLayerTreeDirectManipulationDrafts?: () => void;
  readonly onSelectDrawableLayer: (drawableId: string) => void;
  readonly onToggleDrawableLayerLock: (drawableId: string) => void;
  readonly onToggleDrawableEditorHidden: (drawableId: string) => void;
  readonly onToggleDrawableRuntimeVisibility: (drawableId: string) => void;
  readonly onMoveDrawableLayer: (drawableId: string, direction: EditorDrawableLayerMoveDirection) => void;
  readonly onNudgeMeshVertex: (command: EditorMeshVertexNudgeCommand) => void;
  readonly onSelectMeshCanvasVertex: (command: MeshCanvasVertexSelectionCommand) => void;
  readonly onNudgeMeshCanvasSelection: (delta: { readonly x: number; readonly y: number }) => void;
  readonly onDragMeshCanvasSelection: (delta: { readonly x: number; readonly y: number }) => void;
  readonly onAddMeshVertex: (command: MeshTopologyAddVertexDraftCommand) => void;
  readonly onRemoveSelectedMeshVertex: (command: MeshTopologyRemoveVertexDraftCommand) => void;
  readonly onAddMeshTriangle: (command: MeshTopologyAddTriangleDraftCommand) => void;
  readonly onRemoveMeshTriangle: (command: MeshTopologyRemoveTriangleDraftCommand) => void;
  readonly onNudgeMeshUv: (command: MeshUvNudgeDraftCommand) => void;
  readonly onCommitCreateDynamicsGroup: (command: EditorDynamicsCreateCommand) => void;
  readonly onCommitUpdateDynamicsGroup: (command: EditorUpdateDynamicsGroupCommand) => void;
  readonly onCommitCreateRotation2dRigControl: (
    command: EditorWorkflowCreateRotation2dRigControlCommand
  ) => void;
  readonly onCommitCreateWarpLattice2dRigControl: (
    command: EditorWorkflowCreateWarpLattice2dRigControlCommand
  ) => void;
  readonly onCommitBindRigControlChild: (command: EditorWorkflowBindRigControlChildCommand) => void;
  readonly onCommitBindWarpLattice2dChild: (
    command: EditorWorkflowBindWarpLattice2dChildCommand
  ) => void;
  readonly onCommitAddWarpLattice2dControlPointOffsetsKeyform: (
    command: EditorWorkflowAddWarpLattice2dControlPointOffsetsKeyformCommand
  ) => void;
  readonly onCommitSetMaskRelation: (command: EditorWorkflowSetMaskRelationCommand) => void;
  readonly onCommitAddDrawableOpacityKeyform: (
    command: EditorWorkflowAddDrawableOpacityKeyformCommand
  ) => void;
  readonly onRunDynamicsPreview: (frameCount: number) => void;
  readonly onResetDynamicsPreview: () => void;
  readonly onConfirmSourceIntakeDraft: (
    draft: EditorSemanticState["sourceIntakeDraft"],
    selectedFileBytes?: SourceIntakeSelectedFileBytes
  ) => unknown | Promise<unknown>;
  readonly onParseExplicitPsdImportFile: (
    command: EditorExplicitPsdImportFileCommand
  ) => unknown | Promise<unknown>;
  readonly onIntakeExplicitPsdLayer: (
    command: EditorExplicitPsdLayerIntakeCommand
  ) => unknown | Promise<unknown>;
  readonly onIntakeExplicitPsdLayerBatch?: (
    command: EditorExplicitPsdLayerBatchIntakeCommand
  ) => unknown | Promise<unknown>;
  readonly onGenerateExplicitPsdImportPlanPreview?: (
    command: EditorExplicitPsdImportPlanPreviewCommand
  ) => unknown | Promise<unknown>;
  readonly onIntakeApprovedExplicitPsdImportPlan?: (
    command: EditorExplicitPsdImportPlanApprovedBatchIntakeCommand
  ) => unknown | Promise<unknown>;
  readonly onGenerateExplicitPsdStructuralScaffoldPreview?: (
    command: EditorExplicitPsdStructuralScaffoldPreviewCommand
  ) => unknown | Promise<unknown>;
  readonly onCommitExplicitPsdStructuralScaffold?: (
    command: EditorExplicitPsdStructuralScaffoldCommitCommand
  ) => unknown | Promise<unknown>;
  readonly onSaveProject: () => void;
  readonly onLoadProject: () => void;
  readonly onResetProject: () => void;
  readonly onRunProductPreflight?: () => void | Promise<void>;
  readonly onReviewCodexProposalText?: (proposalText: string) => void | Promise<void>;
  readonly onClearCodexProposalReview?: CodexProposalReviewPanelCallback;
  readonly onRequestCodexProposalApproval?: CodexProposalReviewPanelCallback;
  readonly onRecordCodexProposalApproval?: CodexProposalReviewPanelCallback;
  readonly onCommitApprovedCodexProposal?: CodexProposalReviewPanelCallback;
  readonly onExportPortableBundle?: () => void | Promise<void>;
  readonly onImportPortableBundleText?: (bundleText: string) => void | Promise<void>;
  readonly onCreateTutorialMiniModel: () => void;
  readonly onApplyTutorialSmallEdit: () => void;
  readonly onSelectTutorialTarget: (target: TutorialSelectedTargetState | null) => void;
  readonly onSetPreviewParameterValue: (parameterId: string, value: number) => void;
  readonly onResetPreviewParameterValues: () => void;
  readonly onOpenViewerRuntimeSurface: () => void;
  readonly onCloseViewerRuntimeSurface: () => void;
  readonly onSetViewerParameterValue: (parameterId: string, value: number) => void;
  readonly onResetViewerParameterValues: () => void;
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

  titleGroup.append(title, workflowStatus, createAppBarActions(options));
  appBar.append(titleGroup, createPackageStatus(options.state, options.viewModel));

  const workspace = document.createElement("section");
  workspace.className = "editor-workspace";
  workspace.setAttribute("aria-label", "Editor workspace");
  applyShellSurfaceMetadata(workspace, shellSurfaces.authoringWorkspace, {
    group: "workspace-shell"
  });

  const parametersPanel = document.createElement("section");
  parametersPanel.className = "editor-panel editor-panel--parameters";
  parametersPanel.setAttribute("aria-labelledby", "editor-parameters-heading");
  applyShellSurfaceMetadata(parametersPanel, shellSurfaces.authoringWorkspace, {
    group: "parameter-list"
  });

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
  applyShellSurfaceMetadata(operationPanel, shellSurfaces.authoringWorkspace, {
    group: "parameter-operation"
  });

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
    onNudgeMeshVertex: options.onNudgeMeshVertex,
    onSelectMeshCanvasVertex: options.onSelectMeshCanvasVertex,
    onNudgeMeshCanvasSelection: options.onNudgeMeshCanvasSelection,
    onDragMeshCanvasSelection: options.onDragMeshCanvasSelection,
    onAddMeshVertex: options.onAddMeshVertex,
    onRemoveSelectedMeshVertex: options.onRemoveSelectedMeshVertex,
    onAddMeshTriangle: options.onAddMeshTriangle,
    onRemoveMeshTriangle: options.onRemoveMeshTriangle,
    onNudgeMeshUv: options.onNudgeMeshUv
  });
  applyShellSurfaceMetadata(drawableAuthoringPanel, shellSurfaces.authoringWorkspace, {
    group: "drawable-authoring"
  });
  const partsTreeSurface = createPartsTreeShellSurface(options);
  const sourceIntakePanel = createSourceIntakePanel({
    draft: options.state.sourceIntakeDraft,
    viewModel: options.viewModel.sourceIntake,
    onConfirmDraft: options.onConfirmSourceIntakeDraft
  });
  applyShellSurfaceMetadata(sourceIntakePanel, shellSurfaces.sourceIntakeTask, {
    group: "source-intake"
  });
  const toolboxSurface = createAuthoringToolboxSurface(options);
  const activeTask =
    options.activeTask === "psdImport" ? createPsdImportTaskShell(options) : null;
  const dynamicsPanel = createDynamicsPanel({
    state: options.state,
    viewModel: options.viewModel,
    onCommitCreateDynamicsGroup: options.onCommitCreateDynamicsGroup,
    onCommitUpdateDynamicsGroup: options.onCommitUpdateDynamicsGroup,
    onRunDynamicsPreview: options.onRunDynamicsPreview,
    onResetDynamicsPreview: options.onResetDynamicsPreview
  });
  applyShellSurfaceMetadata(dynamicsPanel, shellSurfaces.authoringWorkspace, {
    group: "active-tool-dynamics"
  });
  const rigControlPanel = createRigControlPanel({
    state: options.state,
    viewModel: options.viewModel,
    preview: options.previewProjection,
    viewerRuntimeProjection: options.viewerRuntimeProjection,
    onCommitCreateRotation2dRigControl: options.onCommitCreateRotation2dRigControl,
    onCommitBindRigControlChild: options.onCommitBindRigControlChild,
    onDraftCreateWarpLattice2dRigControl: options.onCommitCreateWarpLattice2dRigControl,
    onDraftBindWarpLattice2dChild: options.onCommitBindWarpLattice2dChild,
    onDraftAddWarpLattice2dControlPointOffsetsKeyform:
      options.onCommitAddWarpLattice2dControlPointOffsetsKeyform
  });
  applyShellSurfaceMetadata(rigControlPanel, shellSurfaces.authoringWorkspace, {
    group: "active-tool-rig"
  });
  const compositionPanel = createCompositionPanel({
    state: options.state,
    viewModel: options.viewModel,
    preview: options.previewProjection,
    viewerRuntimeProjection: options.viewerRuntimeProjection,
    onCommitSetMaskRelation: options.onCommitSetMaskRelation,
    onCommitAddDrawableOpacityKeyform: options.onCommitAddDrawableOpacityKeyform
  });
  applyShellSurfaceMetadata(compositionPanel, shellSurfaces.authoringWorkspace, {
    group: "drawable-composition"
  });
  const textureAtlas = resolveTextureAtlas(options);
  const previewPanel = createPreviewPanel({
    viewModel: options.viewModel,
    preview: applyEditorPreviewTextureAssets({
      preview: options.previewProjection,
      ...(textureAtlas === undefined ? {} : { textureAtlas }),
      drawableTextures: createDrawableTextureReferences(options.state)
    }),
    onSetPreviewParameterValue: options.onSetPreviewParameterValue,
    onResetPreviewParameterValues: options.onResetPreviewParameterValues
  });
  applyShellSurfaceMetadata(previewPanel, shellSurfaces.authoringWorkspace, {
    group: "canvas-preview"
  });
  const canvasPreviewRegion = createCanvasPreviewRegion(previewPanel);
  const inspectorSurface = createWorkspaceInspectorShellSurface(options);
  const parameterBarSurface = createWorkspaceParameterBarShellSurface(options);
  const diagnosticsStripSurface = createWorkspaceDiagnosticsStripShellSurface(options);
  const tutorialWorkflowPanel = createTutorialWorkflowPanel({
    viewModel: options.viewModel.tutorialGuidedWorkflow,
    onCreateTutorialMiniModel: options.onCreateTutorialMiniModel,
    onApplyTutorialSmallEdit: options.onApplyTutorialSmallEdit,
    onSelectTutorialTarget: options.onSelectTutorialTarget
  });
  applyShellSurfaceMetadata(tutorialWorkflowPanel, shellSurfaces.tutorialTask, {
    group: "tutorial-workflow"
  });
  const viewerRuntimePanel =
    options.viewModel.viewerRuntime.isOpen
      ? applyShellSurfaceMetadata(
          createViewerRuntimePanel({
            state: options.state,
            viewModel: options.viewModel,
            projection: options.viewerRuntimeProjection,
            latestProjectPersistenceResult: options.latestProjectPersistenceResult,
            onCloseViewerRuntimeSurface: options.onCloseViewerRuntimeSurface,
            onSetViewerParameterValue: options.onSetViewerParameterValue,
            onResetViewerParameterValues: options.onResetViewerParameterValues
          }),
          shellSurfaces.viewerRuntimeView,
          { group: "viewer-runtime" }
        )
      : null;
  const projectPersistencePanel = createProjectPersistencePanel({
    viewModel: options.viewModel,
    latestProjectPersistenceResult: options.latestProjectPersistenceResult,
    onSaveProject: options.onSaveProject,
    onLoadProject: options.onLoadProject,
    onResetProject: options.onResetProject,
    ...(options.onExportPortableBundle === undefined
      ? {}
      : { onExportPortableBundle: options.onExportPortableBundle }),
    ...(options.onImportPortableBundleText === undefined
      ? {}
      : { onImportPortableBundleText: options.onImportPortableBundleText })
  });
  applyShellSurfaceMetadata(projectPersistencePanel, shellSurfaces.projectStorageTask, {
    group: "project-persistence"
  });
  const productPreflightPanel = createProductPreflightPanel({
    state: options.state.productPreflight,
    comparisonState: options.state.productPreflightComparison,
    isPackageLoaded: options.viewModel.isPackageLoaded,
    currentPackageRevision: options.state.revision.packageRevision,
    ...(options.onRunProductPreflight === undefined
      ? {}
      : { onRunProductPreflight: options.onRunProductPreflight })
  });
  applyShellSurfaceMetadata(productPreflightPanel, shellSurfaces.validationTask, {
    group: "product-preflight"
  });
  const codexProposalReviewPanel = createCodexProposalReviewPanel({
    state: options.state.codexProposalReview,
    isPackageLoaded: options.viewModel.isPackageLoaded,
    ...(options.onReviewCodexProposalText === undefined
      ? {}
      : { onReviewProposalText: options.onReviewCodexProposalText }),
    ...(options.onClearCodexProposalReview === undefined
      ? {}
      : { onClearReview: options.onClearCodexProposalReview }),
    ...(options.onRequestCodexProposalApproval === undefined
      ? {}
      : { onRequestApproval: options.onRequestCodexProposalApproval }),
    ...(options.onRecordCodexProposalApproval === undefined
      ? {}
      : { onRecordApproval: options.onRecordCodexProposalApproval }),
    ...(options.onCommitApprovedCodexProposal === undefined
      ? {}
      : { onCommitApprovedProposal: options.onCommitApprovedCodexProposal })
  });
  applyShellSurfaceMetadata(codexProposalReviewPanel, shellSurfaces.codexAutomationView, {
    group: "proposal-review"
  });
  const aiApprovalPanel = createAiApprovalPanel({
    viewModel: options.viewModel,
    onDryRunCreateParameter: options.onDryRunAiCreateParameter,
    onApproveLatestDryRun: options.onApproveLatestAiDryRun,
    onRejectPendingDryRun: options.onRejectLatestAiDryRun,
    onCommitApprovedOperation: options.onCommitApprovedAiOperation
  });
  applyShellSurfaceMetadata(aiApprovalPanel, shellSurfaces.codexAutomationView, {
    group: "ai-approval"
  });
  const aiTranscriptPanel = createAiTranscriptPanel({
    entries: options.viewModel.aiApproval.transcriptEntries
  });
  applyShellSurfaceMetadata(aiTranscriptPanel, shellSurfaces.codexAutomationView, {
    group: "ai-transcript"
  });

  const persistencePanel = document.createElement("section");
  persistencePanel.className = "editor-persistence-grid";
  persistencePanel.setAttribute("aria-label", "Operation persistence evidence");
  applyShellSurfaceMetadata(persistencePanel, shellSurfaces.diagnosticsEvidenceView, {
    group: "operation-persistence-evidence"
  });

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
    createAuthoringWorkspacePrimaryLayout({
      toolboxSurface,
      partsTreeSurface,
      canvasPreviewRegion,
      inspectorSurface,
      parameterBarSurface,
      diagnosticsStripSurface
    }),
    ...(activeTask === null ? [] : [activeTask]),
    createWorkspaceSupportRegion([
      parametersPanel,
      tutorialWorkflowPanel,
      ...(viewerRuntimePanel === null ? [] : [viewerRuntimePanel]),
      compositionPanel,
      rigControlPanel,
      dynamicsPanel,
      operationPanel,
      drawableAuthoringPanel,
      sourceIntakePanel,
      projectPersistencePanel,
      productPreflightPanel,
      codexProposalReviewPanel,
      aiApprovalPanel,
      aiTranscriptPanel,
      persistencePanel
    ])
  );
  shell.append(appBar, workspace);

  return shell;
};

const createAppBarActions = (options: EditorAppShellOptions): HTMLElement => {
  const actions = document.createElement("div");
  actions.className = "project-persistence-panel__actions";

  const viewerRuntime = document.createElement("button");
  viewerRuntime.type = "button";
  viewerRuntime.className = "editor-button project-persistence-panel__button";
  viewerRuntime.dataset.testid = editorTestIds.viewerRuntimeOpen;
  viewerRuntime.disabled = !options.viewModel.isPackageLoaded;
  viewerRuntime.textContent = options.viewModel.viewerRuntime.openButtonLabel;
  viewerRuntime.setAttribute("aria-expanded", String(options.viewModel.viewerRuntime.isOpen));
  viewerRuntime.addEventListener("click", () => {
    if (options.viewModel.viewerRuntime.isOpen) {
      options.onCloseViewerRuntimeSurface();
      return;
    }

    options.onOpenViewerRuntimeSurface();
  });
  actions.append(viewerRuntime);

  return actions;
};

const createPsdImportTaskShell = (options: EditorAppShellOptions): HTMLElement => {
  const observation = projectExplicitPsdImportTaskObservation(options.state.explicitPsdImport);

  return createTaskShell({
    surface: shellSurfaces.psdImportTask,
    surfaceMetadata: { group: "psd-import" },
    title: "PSD Import",
    status: observation.humanSummary.text,
    back: {
      ariaLabel: "Back to authoring workspace",
      label: "Back",
      ...(options.onCloseActiveTask === undefined ? {} : { onClick: options.onCloseActiveTask })
    },
    close: {
      ariaLabel: "Close PSD import task",
      label: "Close",
      ...(options.onCloseActiveTask === undefined ? {} : { onClick: options.onCloseActiveTask })
    },
    diagnosticsSummary: createPsdImportTaskObservationSummary(observation),
    content: createPsdImportTaskPanel(createPsdImportTaskContentOptions(options))
  });
};

const createPsdImportTaskPanel = (
  contentOptions: ExplicitPsdImportTaskContentOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "explicit-psd-import-panel explicit-psd-import-panel--task";
  panel.dataset.testid = editorTestIds.explicitPsdImportPanel;
  panel.setAttribute("aria-label", "PSD Import");
  applyShellSurfaceMetadata(panel, shellSurfaces.psdImportTask, {
    group: "psd-import-panel"
  });
  panel.append(createExplicitPsdImportTaskContent(contentOptions));
  return panel;
};

const createPsdImportTaskObservationSummary = (
  observation: ExplicitPsdImportTaskObservationState
): HTMLElement => {
  const summary = document.createElement("section");
  summary.className = "editor-task-observation-summary editor-task-observation-summary--psd-import";
  summary.setAttribute("aria-label", "PSD import task observation summary");
  summary.dataset.psdImportTaskSchemaVersion = observation.schemaVersion;
  summary.dataset.psdImportTaskParseStatus = observation.parseStatus;
  summary.dataset.psdImportTaskEvidenceStatus = observation.evidenceBoundary.detailStatus;

  const humanSummary = document.createElement("p");
  humanSummary.textContent = observation.humanSummary.text;

  const evidenceSummary = document.createElement("p");
  evidenceSummary.textContent = observation.evidenceBoundary.summary;

  summary.append(humanSummary, evidenceSummary);
  return summary;
};

const createPsdImportTaskContentOptions = (
  options: EditorAppShellOptions
): ExplicitPsdImportTaskContentOptions => ({
  viewModel: options.viewModel.explicitPsdImport,
  destinationParts: options.state.parts.map((part) => ({
    partId: part.partId,
    label: `${part.displayName} / ${part.partId}`
  })),
  onParsePsdFile: options.onParseExplicitPsdImportFile,
  onIntakeSelectedLayer: options.onIntakeExplicitPsdLayer,
  ...(options.onIntakeExplicitPsdLayerBatch === undefined
    ? {}
    : { onIntakeSelectedLayersBatch: options.onIntakeExplicitPsdLayerBatch }),
  ...(options.onGenerateExplicitPsdImportPlanPreview === undefined
    ? {}
    : { onGenerateImportPlanPreview: options.onGenerateExplicitPsdImportPlanPreview }),
  ...(options.onIntakeApprovedExplicitPsdImportPlan === undefined
    ? {}
    : { onIntakeApprovedImportPlanCandidates: options.onIntakeApprovedExplicitPsdImportPlan }),
  ...(options.onGenerateExplicitPsdStructuralScaffoldPreview === undefined
    ? {}
    : { onGenerateStructuralScaffoldPreview: options.onGenerateExplicitPsdStructuralScaffoldPreview }),
  ...(options.onCommitExplicitPsdStructuralScaffold === undefined
    ? {}
    : { onCommitStructuralScaffold: options.onCommitExplicitPsdStructuralScaffold })
});

const resolveTextureAtlas = (options: EditorAppShellOptions): TextureAtlasFileDto | undefined => {
  const latestSessionAtlas = options.latestPersistenceResult?.reloadedDocument.assets.textureAtlas;
  if (latestSessionAtlas !== undefined) {
    return latestSessionAtlas;
  }

  const projectResult = options.latestProjectPersistenceResult;
  if (projectResult?.status === "saved") {
    return projectResult.snapshot.document.assets.textureAtlas;
  }

  if (projectResult?.status === "portableExported") {
    return projectResult.snapshot.document.assets.textureAtlas;
  }

  if (projectResult?.status === "loaded") {
    return parsePackageDocumentFromFileSet(projectResult.packageFileSet).assets.textureAtlas;
  }

  if (projectResult?.status === "portableImported") {
    return projectResult.snapshot.document.assets.textureAtlas;
  }

  return undefined;
};

const createDrawableTextureReferences = (
  state: EditorSemanticState
): readonly {
  readonly drawableId: string;
  readonly textureId?: string;
  readonly sourceAssetId?: string;
  readonly sourceLayerId?: string;
}[] => {
  const sourceLayerIdsByDrawableId = new Map<string, string>();
  for (const sourceAsset of state.sourceAssets) {
    for (const sourceLayer of sourceAsset.layers) {
      for (const drawableId of sourceLayer.mappedDrawableIds) {
        sourceLayerIdsByDrawableId.set(drawableId, sourceLayer.sourceLayerId);
      }
    }
  }

  return state.drawables.map((drawable) => {
    const sourceLayerId = sourceLayerIdsByDrawableId.get(drawable.drawableId);

    return {
      drawableId: drawable.drawableId,
      ...(drawable.textureId.trim().length === 0 ? {} : { textureId: drawable.textureId }),
      ...(drawable.sourceAssetId.trim().length === 0 ? {} : { sourceAssetId: drawable.sourceAssetId }),
      ...(sourceLayerId === undefined ? {} : { sourceLayerId })
    };
  });
};
