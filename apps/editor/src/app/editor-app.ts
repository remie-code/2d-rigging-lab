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
