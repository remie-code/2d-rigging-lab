import type {
  EditorViewerRuntimeProjection,
  EditorWorkflowPersistenceResult
} from "../../editor-workflow/index.js";
import {
  editorTestIds,
  type EditorSemanticState,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";
import { createViewerRuntimeParameterControls } from "./viewer-runtime-parameter-controls.js";
import {
  createViewerRuntimeDiffSummary,
  createViewerRuntimePackageState,
  createViewerRuntimeSnapshotSummary,
  createViewerRuntimeValidationDiagnostics
} from "./viewer-runtime-summary.js";

export interface ViewerRuntimePanelOptions {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly projection: EditorViewerRuntimeProjection | null;
  readonly latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null;
  readonly onCloseViewerRuntimeSurface: () => void;
  readonly onSetViewerParameterValue: (parameterId: string, value: number) => void;
  readonly onResetViewerParameterValues: () => void;
}

export const createViewerRuntimePanel = (
  options: ViewerRuntimePanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel viewer-runtime-panel";
  panel.dataset.testid = editorTestIds.viewerRuntimePanel;
  panel.setAttribute("aria-labelledby", "viewer-runtime-heading");

  const heading = document.createElement("h2");
  heading.id = "viewer-runtime-heading";
  heading.textContent = "Viewer / Runtime";

  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.viewerRuntime.parameterCountLabel;

  panel.append(
    createHeaderActions(options),
    heading,
    meta,
    createViewerRuntimePackageState({
      state: options.state,
      latestProjectPersistenceResult: options.latestProjectPersistenceResult
    }),
    createViewerRuntimeSnapshotSummary(options.projection),
    createViewerRuntimeDiffSummary(options.projection),
    createViewerRuntimeValidationDiagnostics(options.projection)
  );

  if (!options.viewModel.viewerRuntime.hasParameters) {
    const empty = document.createElement("p");
    empty.className = "preview-panel__empty";
    empty.textContent = options.viewModel.viewerRuntime.emptyMessage;
    panel.append(empty);
    return panel;
  }

  panel.append(
    createViewerRuntimeParameterControls({
      viewModel: options.viewModel.viewerRuntime,
      onSetViewerParameterValue: options.onSetViewerParameterValue
    }),
    createResetButton(options)
  );

  return panel;
};

const createHeaderActions = (
  options: ViewerRuntimePanelOptions
): HTMLElement => {
  const actions = document.createElement("div");
  actions.className = "project-persistence-panel__actions";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "editor-button project-persistence-panel__button";
  close.dataset.testid = editorTestIds.viewerRuntimeClose;
  close.textContent = options.viewModel.viewerRuntime.closeButtonLabel;
  close.addEventListener("click", options.onCloseViewerRuntimeSurface);
  actions.append(close);

  return actions;
};

const createResetButton = (
  options: ViewerRuntimePanelOptions
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-button preview-panel__reset";
  button.dataset.testid = editorTestIds.viewerRuntimeReset;
  button.textContent = options.viewModel.viewerRuntime.resetLabel;
  button.disabled = options.viewModel.viewerRuntime.authoredInputCount === 0;
  button.addEventListener("click", options.onResetViewerParameterValues);
  return button;
};
