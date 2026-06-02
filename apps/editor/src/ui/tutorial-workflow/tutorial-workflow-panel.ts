import {
  editorTestIds,
  type TutorialGuidedWorkflowViewModel,
  type TutorialSelectedTargetState
} from "../../editor-state/index.js";

export interface TutorialWorkflowPanelOptions {
  readonly viewModel: TutorialGuidedWorkflowViewModel;
  readonly onCreateTutorialMiniModel: () => void;
  readonly onApplyTutorialSmallEdit: () => void;
  readonly onSelectTutorialTarget: (target: TutorialSelectedTargetState | null) => void;
}

const wrappingPanelTextStyle = "min-width: 0; max-width: 100%; overflow-wrap: anywhere;";

export const createTutorialWorkflowPanel = (
  options: TutorialWorkflowPanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel";
  panel.dataset.testid = editorTestIds.tutorialWorkflowPanel;
  panel.setAttribute("aria-labelledby", "tutorial-workflow-heading");

  const heading = document.createElement("h2");
  heading.id = "tutorial-workflow-heading";
  heading.textContent = options.viewModel.recipeLabel;

  const readiness = document.createElement("p");
  readiness.className = "editor-panel__meta";
  readiness.setAttribute("style", wrappingPanelTextStyle);
  readiness.textContent = options.viewModel.readinessLabel;

  const actions = document.createElement("div");
  actions.className = "project-persistence-panel__actions";
  actions.append(
    createActionButton({
      testId: editorTestIds.tutorialWorkflowCreate,
      label: "Create tutorial mini model",
      onClick: options.onCreateTutorialMiniModel
    }),
    createActionButton({
      testId: editorTestIds.tutorialWorkflowSmallEdit,
      label: options.viewModel.smallEditLabel,
      disabled: !options.viewModel.canApplySmallEdit,
      onClick: options.onApplyTutorialSmallEdit
    })
  );

  const targetSelect = createTargetSelect(options);
  const steps = createStepList(options.viewModel);
  const nonGoals = document.createElement("p");
  nonGoals.className = "editor-panel__meta";
  nonGoals.dataset.testid = editorTestIds.tutorialWorkflowNonGoals;
  nonGoals.setAttribute("style", wrappingPanelTextStyle);
  nonGoals.textContent = options.viewModel.nonGoalLabel;

  panel.append(heading, readiness, actions, targetSelect, steps, nonGoals);

  return panel;
};

const createTargetSelect = (options: TutorialWorkflowPanelOptions): HTMLElement => {
  const field = document.createElement("label");
  field.className = "editor-field editor-field--wide";
  field.textContent = "Selected evidence target";

  const select = document.createElement("select");
  select.dataset.testid = editorTestIds.tutorialWorkflowTargetSelect;
  select.setAttribute("aria-label", "Selected tutorial evidence target");

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = options.viewModel.selectedTargetLabel;
  select.append(empty);

  for (const target of options.viewModel.targetOptions) {
    const option = document.createElement("option");
    option.value = encodeTargetValue(target);
    option.textContent = target.label;
    option.selected = target.selected;
    select.append(option);
  }

  select.addEventListener("change", () => {
    options.onSelectTutorialTarget(decodeTargetValue(select.value));
  });

  field.append(select);

  return field;
};

const createStepList = (viewModel: TutorialGuidedWorkflowViewModel): HTMLElement => {
  const list = document.createElement("ol");
  list.dataset.testid = editorTestIds.tutorialWorkflowSteps;
  list.setAttribute("style", wrappingPanelTextStyle);

  for (const step of viewModel.steps) {
    const item = document.createElement("li");
    item.setAttribute("style", wrappingPanelTextStyle);
    item.append(
      createTextBlock(`${step.title}: ${step.statusLabel}`),
      createTextBlock(step.evidenceLabel),
      createTextBlock(step.missingEvidenceLabel)
    );
    list.append(item);
  }

  return list;
};

const createActionButton = (input: {
  readonly testId: string;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-button project-persistence-panel__button";
  button.dataset.testid = input.testId;
  button.disabled = input.disabled ?? false;
  button.textContent = input.label;
  button.addEventListener("click", input.onClick);
  return button;
};

const createTextBlock = (text: string): HTMLElement => {
  const block = document.createElement("p");
  block.className = "editor-panel__meta";
  block.setAttribute("style", wrappingPanelTextStyle);
  block.textContent = text;
  return block;
};

const encodeTargetValue = (
  target: Pick<TutorialSelectedTargetState, "kind" | "id">
): string => `${target.kind}:${target.id}`;

const decodeTargetValue = (value: string): TutorialSelectedTargetState | null => {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  const kind = value.slice(0, separatorIndex) as TutorialSelectedTargetState["kind"];
  const id = value.slice(separatorIndex + 1);
  return id.length === 0 ? null : { kind, id };
};
