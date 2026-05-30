import type { EditorCreateDrawablePresetCommand } from "../../editor-session/index.js";
import {
  editorTestIds,
  type EditorSemanticState,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";
import { createDrawableAuthoringForm } from "./drawable-authoring-form.js";
import { createDrawableList } from "./drawable-list.js";

export interface DrawableAuthoringPanelOptions {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly onCommitCreateDrawable: (command: EditorCreateDrawablePresetCommand) => void;
}

export const createDrawableAuthoringPanel = (
  options: DrawableAuthoringPanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel drawable-authoring-panel";
  panel.dataset.testid = editorTestIds.drawableAuthoringPanel;
  panel.setAttribute("aria-labelledby", "editor-drawable-authoring-heading");

  const heading = document.createElement("h2");
  heading.id = "editor-drawable-authoring-heading";
  heading.textContent = "Drawable Authoring";

  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.drawableAuthoring.drawableCountLabel;

  panel.append(
    heading,
    meta,
    createDefaultSummary(options),
    createDrawableAuthoringForm({
      disabled: !options.viewModel.drawableAuthoring.canSubmitCreateDrawable,
      draft: options.state.pendingCreateDrawable,
      onSubmit: options.onCommitCreateDrawable
    }),
    createResultSummary(options),
    createDrawableList(options.viewModel.drawableAuthoring.drawables)
  );

  return panel;
};

const createDefaultSummary = (options: DrawableAuthoringPanelOptions): HTMLElement => {
  const summary = document.createElement("dl");
  summary.className = "drawable-authoring-summary";

  appendFact(summary, "Source", options.viewModel.drawableAuthoring.sourceLabel || "Unavailable");
  appendFact(summary, "Part", options.viewModel.drawableAuthoring.partLabel || "Unavailable");
  appendFact(summary, "Bounds", options.viewModel.drawableAuthoring.boundsLabel);
  appendFact(summary, "Mesh", options.viewModel.drawableAuthoring.meshMethodLabel);

  return summary;
};

const createResultSummary = (options: DrawableAuthoringPanelOptions): HTMLElement => {
  const result = document.createElement("section");
  result.className = "drawable-authoring-result";
  result.dataset.testid = editorTestIds.drawableResult;
  result.setAttribute("role", "status");
  result.setAttribute("aria-label", "Drawable authoring result");

  const label = document.createElement("p");
  label.className = "drawable-authoring-result__label";
  label.textContent = options.viewModel.drawableAuthoring.resultLabel;
  result.append(label);

  if (options.state.pendingCreateDrawable.diagnostics.length > 0) {
    const list = document.createElement("ul");
    list.className = "drawable-authoring-result__diagnostics";
    for (const diagnostic of options.state.pendingCreateDrawable.diagnostics) {
      const item = document.createElement("li");
      item.textContent = `${diagnostic.severity}: ${diagnostic.message}`;
      list.append(item);
    }
    result.append(list);
  }

  return result;
};

const appendFact = (list: HTMLDListElement, label: string, value: string): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  list.append(term, description);
};
