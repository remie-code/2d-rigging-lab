import { createEditorWorkflowController } from "../editor-workflow/index.js";
import {
  projectEditorWorkflowViewModel,
  type EditorSemanticState
} from "../editor-state/index.js";
import { createBrowserProjectStore } from "../project-persistence/index.js";
import { createEditorAppShell } from "../ui/app-shell/app-shell.js";

export function mountEditorApp(root: HTMLElement): void {
  const workflow = createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage: window.localStorage
    })
  });
  let sourceIntakeDraft = workflow.state.sourceIntakeDraft;

  const createAppState = (): EditorSemanticState => ({
    ...workflow.state,
    sourceIntakeDraft
  });

  const render = (): void => {
    const state = createAppState();

    root.replaceChildren(
      createEditorAppShell({
        state,
        viewModel: projectEditorWorkflowViewModel(state),
        previewProjection: workflow.previewProjection,
        viewerRuntimeProjection: workflow.viewerRuntimeProjection,
        latestPersistenceResult: workflow.latestSessionPersistenceResult,
        latestProjectPersistenceResult: workflow.latestProjectPersistenceResult,
        onCommitCreateParameter(command) {
          workflow.commitCreateParameter(command);
          render();
        },
        onCommitCreateDrawablePreset(command) {
          workflow.commitCreateDrawablePreset(command);
          render();
        },
        onCommitCreatePart(command) {
          workflow.commitCreatePart(command);
          render();
        },
        onCommitUpdatePart(command) {
          workflow.commitUpdatePart(command);
          render();
        },
        onCommitSetDrawablePart(command) {
          workflow.commitSetDrawablePart(command);
          render();
        },
        onCommitSetDrawableTexture(command) {
          workflow.commitSetDrawableTexture(command);
          render();
        },
        onDraftLayerTreePartRename(command) {
          workflow.draftLayerTreePartRename(command);
          render();
        },
        onDraftLayerTreePartReparent(command) {
          workflow.draftLayerTreePartReparent(command);
          render();
        },
        onDraftLayerTreeEmptyLeafPartDelete(command) {
          workflow.draftLayerTreeEmptyLeafPartDelete(command);
          render();
        },
        onDraftLayerTreeDrawablePartAssignment(command) {
          workflow.draftLayerTreeDrawablePartAssignment(command);
          render();
        },
        onDraftLayerTreeDrawableTextureAssignment(command) {
          workflow.draftLayerTreeDrawableTextureAssignment(command);
          render();
        },
        onCommitLayerTreeDirectManipulationDrafts() {
          workflow.commitLayerTreeDirectManipulationDrafts();
          render();
        },
        onClearLayerTreeDirectManipulationDrafts() {
          workflow.clearLayerTreeDirectManipulationDrafts();
          render();
        },
        onSelectDrawableLayer(drawableId) {
          workflow.selectDrawableLayer(drawableId);
          render();
        },
        onToggleDrawableLayerLock(drawableId) {
          workflow.toggleDrawableLayerLock(drawableId);
          render();
        },
        onToggleDrawableEditorHidden(drawableId) {
          workflow.toggleDrawableEditorHidden(drawableId);
          render();
        },
        onToggleDrawableRuntimeVisibility(drawableId) {
          workflow.toggleDrawableRuntimeVisibility(drawableId);
          render();
        },
        onMoveDrawableLayer(drawableId, direction) {
          workflow.moveDrawableLayer(drawableId, direction);
          render();
        },
        onNudgeMeshVertex(command) {
          workflow.nudgeMeshVertex(command);
          render();
        },
        onSelectMeshCanvasVertex(command) {
          workflow.selectMeshCanvasVertex(command);
          render();
        },
        onNudgeMeshCanvasSelection(delta) {
          workflow.nudgeMeshCanvasSelection(delta);
          render();
        },
        onDragMeshCanvasSelection(delta) {
          workflow.dragMeshCanvasSelection(delta);
          render();
        },
        onAddMeshVertex(command) {
          workflow.addMeshVertex(command);
          render();
        },
        onRemoveSelectedMeshVertex(command) {
          workflow.removeSelectedMeshVertex(command);
          render();
        },
        onAddMeshTriangle(command) {
          workflow.addMeshTriangle(command);
          render();
        },
        onRemoveMeshTriangle(command) {
          workflow.removeMeshTriangle(command);
          render();
        },
        onNudgeMeshUv(command) {
          workflow.nudgeMeshUv(command);
          render();
        },
        onCommitCreateDynamicsGroup(command) {
          workflow.commitCreateDynamicsGroup(command);
          render();
        },
        onCommitUpdateDynamicsGroup(command) {
          workflow.commitUpdateDynamicsGroup(command);
          render();
        },
        onCommitCreateRotation2dRigControl(command) {
          workflow.commitCreateRotation2dRigControl(command);
          render();
        },
        onCommitCreateWarpLattice2dRigControl(command) {
          workflow.commitCreateWarpLattice2dRigControl(command);
          render();
        },
        onCommitBindRigControlChild(command) {
          workflow.commitBindRigControlChild(command);
          render();
        },
        onCommitBindWarpLattice2dChild(command) {
          workflow.commitBindWarpLattice2dChild(command);
          render();
        },
        onCommitAddWarpLattice2dControlPointOffsetsKeyform(command) {
          workflow.commitAddWarpLattice2dControlPointOffsetsKeyform(command);
          render();
        },
        onCommitSetMaskRelation(command) {
          workflow.commitSetMaskRelation(command);
          render();
        },
        onCommitAddDrawableOpacityKeyform(command) {
          workflow.commitAddDrawableOpacityKeyform(command);
          render();
        },
        onRunDynamicsPreview(frameCount) {
          workflow.runDynamicsPreview(frameCount);
          render();
        },
        onResetDynamicsPreview() {
          workflow.resetDynamicsPreview();
          render();
        },
        async onConfirmSourceIntakeDraft(draft, selectedFileBytes) {
          if (selectedFileBytes === undefined) {
            workflow.commitSourceIntakeDraft(draft);
          } else {
            await workflow.commitSourceIntakeDraftWithSelectedFile(draft, selectedFileBytes);
          }
          sourceIntakeDraft = workflow.state.sourceIntakeDraft;
          render();
        },
        onSaveProject() {
          workflow.saveProject();
          render();
        },
        async onLoadProject() {
          await workflow.loadProjectWithPersistentBytes();
          sourceIntakeDraft = workflow.state.sourceIntakeDraft;
          render();
        },
        onResetProject() {
          workflow.resetToSamplePackage();
          sourceIntakeDraft = workflow.state.sourceIntakeDraft;
          render();
        },
        async onRunProductPreflight() {
          await workflow.runProductPreflight();
          render();
        },
        async onExportPortableBundle() {
          const result = await workflow.exportPortableBundle();
          render();

          if (result.status === "portableExported") {
            triggerPortableBundleDownload(root, {
              bundleJson: result.bundleJson,
              suggestedFilename: result.suggestedFilename
            });
          }
        },
        async onImportPortableBundleText(bundleText) {
          await workflow.importPortableBundle(bundleText);
          sourceIntakeDraft = workflow.state.sourceIntakeDraft;
          render();
        },
        onCreateTutorialMiniModel() {
          workflow.createTutorialMiniModel();
          sourceIntakeDraft = workflow.state.sourceIntakeDraft;
          render();
        },
        onApplyTutorialSmallEdit() {
          workflow.applyTutorialSmallEdit();
          render();
        },
        onSelectTutorialTarget(target) {
          workflow.selectTutorialTarget(target);
          render();
        },
        onSetPreviewParameterValue(parameterId, value) {
          workflow.setPreviewParameterValue(parameterId, value);
          render();
        },
        onResetPreviewParameterValues() {
          workflow.resetPreviewParameterValues();
          render();
        },
        onOpenViewerRuntimeSurface() {
          workflow.openViewerRuntimeSurface();
          render();
        },
        onCloseViewerRuntimeSurface() {
          workflow.closeViewerRuntimeSurface();
          render();
        },
        onSetViewerParameterValue(parameterId, value) {
          workflow.setViewerParameterValue(parameterId, value);
          render();
        },
        onResetViewerParameterValues() {
          workflow.resetViewerParameterValues();
          render();
        },
        async onDryRunAiCreateParameter() {
          await workflow.dryRunAiCreateParameterCommand();
          render();
        },
        async onApproveLatestAiDryRun() {
          await workflow.approveLatestAiDryRun();
          render();
        },
        async onRejectLatestAiDryRun() {
          await workflow.rejectLatestAiDryRun();
          render();
        },
        async onCommitApprovedAiOperation() {
          await workflow.commitApprovedAiOperation();
          render();
        }
      })
    );
  };

  render();
}

const triggerPortableBundleDownload = (
  parent: HTMLElement,
  bundle: {
    readonly bundleJson: string;
    readonly suggestedFilename: string;
  }
): void => {
  const objectUrl = URL.createObjectURL(
    new Blob([bundle.bundleJson], { type: "application/json" })
  );
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = bundle.suggestedFilename;
  link.rel = "noopener";
  link.style.display = "none";

  parent.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};
