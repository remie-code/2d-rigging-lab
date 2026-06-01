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
        onCommitBindRigControlChild(command) {
          workflow.commitBindRigControlChild(command);
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
        onConfirmSourceIntakeDraft(draft) {
          workflow.commitSourceIntakeDraft(draft);
          sourceIntakeDraft = workflow.state.sourceIntakeDraft;
          render();
        },
        onSaveProject() {
          workflow.saveProject();
          render();
        },
        onLoadProject() {
          workflow.loadProject();
          sourceIntakeDraft = workflow.state.sourceIntakeDraft;
          render();
        },
        onResetProject() {
          workflow.resetToSamplePackage();
          sourceIntakeDraft = workflow.state.sourceIntakeDraft;
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
