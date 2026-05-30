import type { EditorPreviewProjectionDto } from "../../editor-preview/preview-dto.js";
import {
  editorTestIds,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";
import { createPreviewParameterControls } from "./preview-parameter-controls.js";
import { createPreviewSummary } from "./preview-summary.js";
import { createPreviewVisual } from "./preview-visual.js";

export interface PreviewPanelOptions {
  readonly viewModel: EditorWorkflowViewModel;
  readonly preview: EditorPreviewProjectionDto | null;
  readonly onSetPreviewParameterValue: (parameterId: string, value: number) => void;
  readonly onResetPreviewParameterValues: () => void;
}

export const createPreviewPanel = (options: PreviewPanelOptions): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel preview-panel";
  panel.dataset.testid = editorTestIds.previewPanel;
  panel.setAttribute("aria-labelledby", "editor-preview-heading");

  const heading = document.createElement("h2");
  heading.id = "editor-preview-heading";
  heading.textContent = "Preview";

  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.previewControls.parameterCountLabel;

  panel.append(heading, meta, createPreviewVisual(options.preview), createPreviewSummary(options.preview));

  if (!options.viewModel.previewControls.hasParameters) {
    const empty = document.createElement("p");
    empty.className = "preview-panel__empty";
    empty.dataset.testid = editorTestIds.previewEmpty;
    empty.textContent = options.viewModel.previewControls.emptyMessage;
    panel.append(empty);
    return panel;
  }

  panel.append(
    createPreviewParameterControls({
      viewModel: options.viewModel.previewControls,
      onSetPreviewParameterValue: options.onSetPreviewParameterValue
    }),
    createResetButton(options)
  );

  return panel;
};

const createResetButton = (options: PreviewPanelOptions): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-button preview-panel__reset";
  button.dataset.testid = editorTestIds.previewReset;
  button.textContent = options.viewModel.previewControls.resetLabel;
  button.disabled = options.viewModel.previewControls.authoredInputCount === 0;
  button.addEventListener("click", options.onResetPreviewParameterValues);
  return button;
};
