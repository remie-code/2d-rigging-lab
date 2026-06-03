import {
  editorTestIds,
  type EditorSemanticState,
  type EditorWorkflowViewModel,
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
  type TutorialSelectedTargetState
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
  EditorWorkflowPersistenceResult
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
import { createLayerTreePanel } from "../layer-tree/index.js";
import { createCompositionPanel } from "../composition-panel/index.js";
import {
  createDynamicsPanel,
  type EditorDynamicsCreateCommand
} from "../dynamics-panel/index.js";
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
import { createRigControlPanel } from "../rig-control-panel/index.js";
import { createSourceIntakePanel } from "../source-assets/index.js";
import { createTutorialWorkflowPanel } from "../tutorial-workflow/index.js";
import { createViewerRuntimePanel } from "../viewer-runtime/index.js";
import { createPackageStatus } from "./package-status.js";

export interface EditorAppShellOptions {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly previewProjection: EditorPreviewProjectionDto | null;
  readonly viewerRuntimeProjection: EditorViewerRuntimeProjection | null;
  readonly latestPersistenceResult: EditorSessionPersistenceResult | null;
  readonly latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null;
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
  readonly onSaveProject: () => void;
  readonly onLoadProject: () => void;
  readonly onResetProject: () => void;
  readonly onRunProductPreflight?: () => void | Promise<void>;
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
  const layerTreePanel = createLayerTreePanel({
    viewModel: options.viewModel.layerTree,
    workflow: options.viewModel.partTextureWorkflow,
    onCreatePart: options.onCommitCreatePart,
    onUpdatePart: options.onCommitUpdatePart,
    onSetDrawablePart: options.onCommitSetDrawablePart,
    onSetDrawableTexture: options.onCommitSetDrawableTexture,
    ...(options.onDraftLayerTreePartRename === undefined
      ? {}
      : { onDraftPartRename: options.onDraftLayerTreePartRename }),
    ...(options.onDraftLayerTreePartReparent === undefined
      ? {}
      : { onDraftPartReparent: options.onDraftLayerTreePartReparent }),
    ...(options.onDraftLayerTreeEmptyLeafPartDelete === undefined
      ? {}
      : { onDraftEmptyLeafPartDelete: options.onDraftLayerTreeEmptyLeafPartDelete }),
    ...(options.onDraftLayerTreeDrawablePartAssignment === undefined
      ? {}
      : { onDraftDrawablePartAssignment: options.onDraftLayerTreeDrawablePartAssignment }),
    ...(options.onDraftLayerTreeDrawableTextureAssignment === undefined
      ? {}
      : { onDraftDrawableTextureAssignment: options.onDraftLayerTreeDrawableTextureAssignment }),
    ...(options.onCommitLayerTreeDirectManipulationDrafts === undefined
      ? {}
      : { onCommitDirectManipulationDrafts: options.onCommitLayerTreeDirectManipulationDrafts }),
    ...(options.onClearLayerTreeDirectManipulationDrafts === undefined
      ? {}
      : { onClearDirectManipulationDrafts: options.onClearLayerTreeDirectManipulationDrafts }),
    onSelectDrawable: options.onSelectDrawableLayer,
    onToggleDrawableLock: options.onToggleDrawableLayerLock,
    onToggleDrawableEditorHidden: options.onToggleDrawableEditorHidden
  });
  const sourceIntakePanel = createSourceIntakePanel({
    draft: options.state.sourceIntakeDraft,
    viewModel: options.viewModel.sourceIntake,
    onConfirmDraft: options.onConfirmSourceIntakeDraft
  });
  const dynamicsPanel = createDynamicsPanel({
    state: options.state,
    viewModel: options.viewModel,
    onCommitCreateDynamicsGroup: options.onCommitCreateDynamicsGroup,
    onCommitUpdateDynamicsGroup: options.onCommitUpdateDynamicsGroup,
    onRunDynamicsPreview: options.onRunDynamicsPreview,
    onResetDynamicsPreview: options.onResetDynamicsPreview
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
  const compositionPanel = createCompositionPanel({
    state: options.state,
    viewModel: options.viewModel,
    preview: options.previewProjection,
    viewerRuntimeProjection: options.viewerRuntimeProjection,
    onCommitSetMaskRelation: options.onCommitSetMaskRelation,
    onCommitAddDrawableOpacityKeyform: options.onCommitAddDrawableOpacityKeyform
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
  const tutorialWorkflowPanel = createTutorialWorkflowPanel({
    viewModel: options.viewModel.tutorialGuidedWorkflow,
    onCreateTutorialMiniModel: options.onCreateTutorialMiniModel,
    onApplyTutorialSmallEdit: options.onApplyTutorialSmallEdit,
    onSelectTutorialTarget: options.onSelectTutorialTarget
  });
  const viewerRuntimePanel =
    options.viewModel.viewerRuntime.isOpen
      ? createViewerRuntimePanel({
          state: options.state,
          viewModel: options.viewModel,
          projection: options.viewerRuntimeProjection,
          latestProjectPersistenceResult: options.latestProjectPersistenceResult,
          onCloseViewerRuntimeSurface: options.onCloseViewerRuntimeSurface,
          onSetViewerParameterValue: options.onSetViewerParameterValue,
          onResetViewerParameterValues: options.onResetViewerParameterValues
        })
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
  const productPreflightPanel = createProductPreflightPanel({
    state: options.state.productPreflight,
    isPackageLoaded: options.viewModel.isPackageLoaded,
    currentPackageRevision: options.state.revision.packageRevision,
    ...(options.onRunProductPreflight === undefined
      ? {}
      : { onRunProductPreflight: options.onRunProductPreflight })
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
    tutorialWorkflowPanel,
    ...(viewerRuntimePanel === null ? [] : [viewerRuntimePanel]),
    compositionPanel,
    rigControlPanel,
    dynamicsPanel,
    operationPanel,
    layerTreePanel,
    drawableAuthoringPanel,
    sourceIntakePanel,
    projectPersistencePanel,
    productPreflightPanel,
    aiApprovalPanel,
    aiTranscriptPanel,
    persistencePanel
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
