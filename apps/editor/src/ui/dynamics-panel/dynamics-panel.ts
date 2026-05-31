import type {
  EditorCreateDynamicsGroupCommand,
  EditorUpdateDynamicsGroupCommand
} from "../../editor-session/index.js";
import {
  createDynamicsGroupUpdateTestId,
  editorTestIds,
  type EditorSemanticState,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";

export type EditorDynamicsCreateCommand =
  Omit<EditorCreateDynamicsGroupCommand, "outputParameterId"> & {
    readonly outputParameterId?: string;
    readonly outputParameterDisplayName?: string;
  };

export interface DynamicsPanelOptions {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly onCommitCreateDynamicsGroup: (command: EditorDynamicsCreateCommand) => void;
  readonly onCommitUpdateDynamicsGroup: (command: EditorUpdateDynamicsGroupCommand) => void;
  readonly onRunDynamicsPreview: (frameCount: number) => void;
  readonly onResetDynamicsPreview: () => void;
}

export const createDynamicsPanel = (options: DynamicsPanelOptions): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel dynamics-panel";
  panel.dataset.testid = editorTestIds.dynamicsPanel;
  panel.setAttribute("aria-labelledby", "editor-dynamics-heading");

  const heading = document.createElement("h2");
  heading.id = "editor-dynamics-heading";
  heading.textContent = "Dynamics";

  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.dynamics.groupCountLabel;

  panel.append(
    heading,
    meta,
    createDynamicsCreateForm(options),
    createDynamicsGroupList(options),
    createDynamicsPreviewControls(options),
    createDynamicsPreviewOutputs(options),
    createDynamicsPreviewEvidence(options),
    createDynamicsValidatorDiagnostics(options)
  );

  return panel;
};

const createDynamicsCreateForm = (options: DynamicsPanelOptions): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "dynamics-form dynamics-form--create";
  form.dataset.testid = editorTestIds.dynamicsCreateForm;

  const displayName = createTextField({
    label: "Group name",
    name: "displayName",
    value: "Open Dynamics Sway",
    required: true,
    wide: true
  });
  const driver = createSelectField({
    label: "Driver",
    name: "driverParameterId",
    options: options.viewModel.dynamics.driverParameters.map((parameter) => ({
      value: parameter.parameterId,
      label: `${parameter.label} / ${parameter.rangeLabel}`
    }))
  });
  const output = createSelectField({
    label: "Output",
    name: "outputParameterId",
    options: [
      {
        value: "__new__",
        label: "New computed output"
      },
      ...options.viewModel.dynamics.computedOutputParameters.map((parameter) => ({
        value: parameter.parameterId,
        label: `${parameter.label} / ${parameter.rangeLabel}`
      }))
    ]
  });
  const outputDisplayName = createTextField({
    label: "Output name",
    name: "outputParameterDisplayName",
    value: "Dynamics Output",
    required: false
  });
  const outputMin = createNumberField({
    label: "Output min",
    name: "outputMin",
    value: -1,
    step: "any"
  });
  const outputMax = createNumberField({
    label: "Output max",
    name: "outputMax",
    value: 1,
    step: "any"
  });
  const stiffness = createNumberField({
    label: "Stiffness",
    name: "stiffness",
    value: 0.25,
    min: "0",
    step: "any"
  });
  const damping = createNumberField({
    label: "Damping",
    name: "damping",
    value: 0.35,
    min: "0",
    step: "any"
  });
  const maxVelocity = createNumberField({
    label: "Max velocity",
    name: "maxVelocity",
    value: 2,
    min: "0.000001",
    step: "any"
  });
  const maxAmplitude = createNumberField({
    label: "Max amplitude",
    name: "maxAmplitude",
    value: 1,
    min: "0.000001",
    step: "any"
  });
  const resetPolicy = createResetPolicyField("reset-on-manual-command");
  const enabled = createCheckboxField({
    label: "Enabled",
    name: "enabled",
    checked: true
  });
  const diagnostics = document.createElement("p");
  diagnostics.className = "dynamics-form__diagnostics";
  diagnostics.setAttribute("role", "status");
  diagnostics.textContent = options.viewModel.dynamics.createDisabledMessage ?? "";

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.dynamicsCreateSubmit;
  submit.disabled = !options.viewModel.dynamics.canCreateGroup;
  submit.textContent = "Create group";

  form.append(
    displayName,
    driver,
    output,
    outputDisplayName,
    outputMin,
    outputMax,
    stiffness,
    damping,
    maxVelocity,
    maxAmplitude,
    resetPolicy,
    enabled,
    diagnostics,
    submit
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readCreateDynamicsGroupCommand(form, diagnostics);
    if (command !== null) {
      options.onCommitCreateDynamicsGroup(command);
    }
  });

  return form;
};

const createDynamicsGroupList = (options: DynamicsPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "dynamics-groups";

  const heading = document.createElement("h3");
  heading.textContent = "Groups";
  section.append(heading);

  if (!options.viewModel.dynamics.hasGroups) {
    const empty = document.createElement("p");
    empty.className = "dynamics-panel__empty";
    empty.textContent = "No dynamics groups";
    section.append(empty);
    return section;
  }

  for (const group of options.viewModel.dynamics.groups) {
    const form = document.createElement("form");
    form.className = "dynamics-group";
    form.dataset.testid = createDynamicsGroupUpdateTestId(group.dynamicsGroupId);

    const title = document.createElement("h4");
    title.textContent = group.displayName;

    const summary = document.createElement("dl");
    summary.className = "dynamics-summary";
    appendFact(summary, "ID", group.dynamicsGroupId);
    appendFact(summary, "Drivers", group.driverLabel);
    appendFact(summary, "Output", group.outputLabel);
    appendFact(summary, "Settings", group.settingsLabel);

    const displayName = createTextField({
      label: "Group name",
      name: "displayName",
      value: group.displayName,
      required: true
    });
    const resetPolicy = createResetPolicyField(group.resetPolicy);
    const enabled = createSelectField({
      label: "State",
      name: "enabled",
      options: [
        { value: "true", label: "Enabled" },
        { value: "false", label: "Disabled" }
      ],
      value: String(group.enabled)
    });
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "editor-button dynamics-panel__secondary-action";
    submit.textContent = "Update";

    form.append(title, summary, displayName, resetPolicy, enabled, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const fields = new FormData(form);
      const nextDisplayName = String(fields.get("displayName") ?? "").trim();
      if (nextDisplayName.length === 0) {
        return;
      }
      options.onCommitUpdateDynamicsGroup({
        dynamicsGroupId: group.dynamicsGroupId,
        displayName: nextDisplayName,
        enabled: String(fields.get("enabled") ?? "true") === "true",
        resetPolicy: readResetPolicy(fields.get("resetPolicy"))
      });
    });
    section.append(form);
  }

  return section;
};

const createDynamicsPreviewControls = (options: DynamicsPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "dynamics-preview-controls";

  const status = document.createElement("p");
  status.className = "dynamics-preview-controls__status";
  status.textContent = options.viewModel.dynamics.previewStatusLabel;

  const frameCount = createNumberField({
    label: "Frames",
    name: "frameCount",
    value: 8,
    min: "1",
    step: "1"
  });
  const run = document.createElement("button");
  run.type = "button";
  run.className = "editor-button editor-button--primary";
  run.dataset.testid = editorTestIds.dynamicsPreviewRun;
  run.disabled = !options.viewModel.dynamics.canRunPreview;
  run.textContent = "Run preview";
  run.addEventListener("click", () => {
    const input = frameCount.querySelector("input") as HTMLInputElement | null;
    options.onRunDynamicsPreview(Number(input?.value ?? 1));
  });

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "editor-button dynamics-panel__secondary-action";
  reset.dataset.testid = editorTestIds.dynamicsPreviewReset;
  reset.disabled = !options.viewModel.dynamics.canResetPreview;
  reset.textContent = "Reset preview";
  reset.addEventListener("click", options.onResetDynamicsPreview);

  section.append(status, frameCount, run, reset);
  return section;
};

const createDynamicsPreviewOutputs = (options: DynamicsPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "dynamics-preview-outputs";
  section.dataset.testid = editorTestIds.dynamicsPreviewOutputs;

  const heading = document.createElement("h3");
  heading.textContent = "Computed Output";
  section.append(heading);

  if (options.viewModel.dynamics.previewOutputs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "dynamics-panel__empty";
    empty.textContent = "No computed output";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  for (const output of options.viewModel.dynamics.previewOutputs) {
    const item = document.createElement("li");
    item.textContent = `${output.dynamicsGroupId} -> ${output.outputParameterId}: ${output.outputValueLabel}; ${output.stateLabel}; ${output.driverValuesLabel}; ${output.targetLabel}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createDynamicsPreviewEvidence = (options: DynamicsPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "dynamics-preview-evidence";
  section.dataset.testid = editorTestIds.dynamicsPreviewEvidence;

  const heading = document.createElement("h3");
  heading.textContent = "Evidence";
  section.append(heading);

  const evidence = options.viewModel.dynamics.previewEvidence;
  if (evidence === null) {
    const empty = document.createElement("p");
    empty.className = "dynamics-panel__empty";
    empty.textContent = "No runtime evidence";
    section.append(empty);
    return section;
  }

  const facts = document.createElement("dl");
  facts.className = "dynamics-summary";
  appendFact(facts, "Snapshot", evidence.snapshotLabel);
  appendFact(facts, "Runtime diff", evidence.runtimeDiffLabel);
  appendFact(facts, "Validation", evidence.validationLabel);
  section.append(facts);
  return section;
};

const createDynamicsValidatorDiagnostics = (options: DynamicsPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "dynamics-validator-diagnostics";
  section.dataset.testid = editorTestIds.dynamicsValidatorDiagnostics;

  const heading = document.createElement("h3");
  heading.textContent = "Validator Diagnostics";
  section.append(heading);

  if (options.viewModel.dynamics.previewDiagnostics.length === 0) {
    const empty = document.createElement("p");
    empty.className = "dynamics-panel__empty";
    empty.textContent = "No diagnostics";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-validator-diagnostics__list";
  for (const diagnostic of options.viewModel.dynamics.previewDiagnostics) {
    const item = document.createElement("li");
    item.textContent = `${diagnostic.severity} / ${diagnostic.status} / ${diagnostic.checkId}: ${diagnostic.message} (${diagnostic.targetLabel})`;
    list.append(item);
  }
  section.append(list);
  return section;
};

interface TextFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly required: boolean;
  readonly wide?: boolean;
}

interface NumberFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly value: number;
  readonly min?: string;
  readonly step: string;
}

interface SelectFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly value?: string;
}

const createTextField = (options: TextFieldOptions): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = options.wide === true ? "editor-field editor-field--wide" : "editor-field";
  label.textContent = options.label;

  const input = document.createElement("input");
  input.name = options.name;
  input.type = "text";
  input.value = options.value;
  input.required = options.required;
  input.autocomplete = "off";

  label.append(input);
  return label;
};

const createNumberField = (options: NumberFieldOptions): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "editor-field";
  label.textContent = options.label;

  const input = document.createElement("input");
  input.name = options.name;
  input.type = "number";
  input.value = String(options.value);
  input.step = options.step;
  if (options.min !== undefined) {
    input.min = options.min;
  }

  label.append(input);
  return label;
};

const createSelectField = (options: SelectFieldOptions): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "editor-field";
  label.textContent = options.label;

  const select = document.createElement("select");
  select.name = options.name;

  for (const option of options.options) {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    if (options.value === option.value) {
      optionElement.selected = true;
    }
    select.append(optionElement);
  }

  label.append(select);
  return label;
};

const createCheckboxField = (options: {
  readonly label: string;
  readonly name: string;
  readonly checked: boolean;
}): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "dynamics-form__checkbox";

  const input = document.createElement("input");
  input.name = options.name;
  input.type = "checkbox";
  input.checked = options.checked;

  const text = document.createElement("span");
  text.textContent = options.label;
  label.append(input, text);
  return label;
};

const createResetPolicyField = (
  value: EditorCreateDynamicsGroupCommand["resetPolicy"]
): HTMLLabelElement =>
  createSelectField({
    label: "Reset policy",
    name: "resetPolicy",
    value,
    options: [
      { value: "reset-on-load", label: "Reset on load" },
      { value: "reset-on-manual-command", label: "Reset on manual command" },
      { value: "reset-on-large-input-jump", label: "Reset on large input jump" }
    ]
  });

const readCreateDynamicsGroupCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement
): EditorDynamicsCreateCommand | null => {
  const fields = new FormData(form);
  const displayName = String(fields.get("displayName") ?? "").trim();
  const driverParameterId = String(fields.get("driverParameterId") ?? "").trim();
  const outputParameterValue = String(fields.get("outputParameterId") ?? "__new__").trim();
  const outputParameterDisplayName = String(fields.get("outputParameterDisplayName") ?? "").trim();
  const outputMin = toFiniteNumber(fields.get("outputMin"));
  const outputMax = toFiniteNumber(fields.get("outputMax"));
  const stiffness = toFiniteNumber(fields.get("stiffness"));
  const damping = toFiniteNumber(fields.get("damping"));
  const maxVelocity = toOptionalFiniteNumber(fields.get("maxVelocity"));
  const maxAmplitude = toOptionalFiniteNumber(fields.get("maxAmplitude"));
  const validationMessage = validateCreateDynamicsInput({
    displayName,
    driverParameterId,
    outputParameterDisplayName,
    outputMin,
    outputMax,
    stiffness,
    damping,
    maxVelocity,
    maxAmplitude,
    createOutput: outputParameterValue === "__new__"
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  diagnostics.textContent = "";

  return {
    displayName,
    enabled: fields.get("enabled") === "on",
    driverParameterId,
    ...(outputParameterValue === "__new__" ? {} : { outputParameterId: outputParameterValue }),
    ...(outputParameterValue === "__new__" ? { outputParameterDisplayName } : {}),
    outputMin,
    outputMax,
    outputScale: 1,
    outputOffset: 0,
    resetPolicy: readResetPolicy(fields.get("resetPolicy")),
    stiffness,
    damping,
    ...(maxVelocity === null ? {} : { maxVelocity }),
    ...(maxAmplitude === null ? {} : { maxAmplitude })
  };
};

const validateCreateDynamicsInput = (input: {
  readonly displayName: string;
  readonly driverParameterId: string;
  readonly outputParameterDisplayName: string;
  readonly outputMin: number;
  readonly outputMax: number;
  readonly stiffness: number;
  readonly damping: number;
  readonly maxVelocity: number | null;
  readonly maxAmplitude: number | null;
  readonly createOutput: boolean;
}): string | null => {
  if (input.displayName.length === 0) {
    return "Group name is required.";
  }

  if (input.driverParameterId.length === 0) {
    return "Driver is required.";
  }

  if (input.createOutput && input.outputParameterDisplayName.length === 0) {
    return "Output name is required.";
  }

  if (
    !Number.isFinite(input.outputMin) ||
    !Number.isFinite(input.outputMax) ||
    !Number.isFinite(input.stiffness) ||
    !Number.isFinite(input.damping)
  ) {
    return "Numeric fields must contain finite values.";
  }

  if (input.outputMin > input.outputMax) {
    return "Output min must be lower than or equal to output max.";
  }

  if (input.stiffness < 0 || input.damping < 0) {
    return "Stiffness and damping must be zero or greater.";
  }

  if (
    (input.maxVelocity !== null && input.maxVelocity <= 0) ||
    (input.maxAmplitude !== null && input.maxAmplitude <= 0)
  ) {
    return "Max velocity and amplitude must be greater than zero.";
  }

  return null;
};

const readResetPolicy = (
  value: FormDataEntryValue | null
): EditorCreateDynamicsGroupCommand["resetPolicy"] => {
  if (
    value === "reset-on-load" ||
    value === "reset-on-manual-command" ||
    value === "reset-on-large-input-jump"
  ) {
    return value;
  }

  return "reset-on-manual-command";
};

const toFiniteNumber = (value: FormDataEntryValue | null): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const toOptionalFiniteNumber = (value: FormDataEntryValue | null): number | null => {
  const text = String(value ?? "").trim();
  if (text.length === 0) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const appendFact = (list: HTMLDListElement, label: string, value: string): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  list.append(term, description);
};
