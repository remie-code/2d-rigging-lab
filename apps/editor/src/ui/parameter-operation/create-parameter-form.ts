import type { EditorCreateParameterCommand } from "../../editor-session/index.js";
import { editorTestIds, type CreateParameterFormState } from "../../editor-state/index.js";

export interface CreateParameterFormOptions {
  readonly disabled: boolean;
  readonly draft: CreateParameterFormState;
  readonly onSubmit: (command: EditorCreateParameterCommand) => void;
}

export const createCreateParameterForm = (options: CreateParameterFormOptions): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-parameter-form";
  form.dataset.testid = editorTestIds.parameterCreateForm;

  const displayName = createTextField({
    label: "Display name",
    name: "displayName",
    value: options.draft.displayName || "Smile",
    required: true
  });
  const min = createNumberField({
    label: "Min",
    name: "min",
    value: options.draft.min,
    step: "any"
  });
  const max = createNumberField({
    label: "Max",
    name: "max",
    value: options.draft.max,
    step: "any"
  });
  const defaultValue = createNumberField({
    label: "Default",
    name: "defaultValue",
    value: options.draft.defaultValue,
    step: "any"
  });
  const recommendedUiStep = createNumberField({
    label: "Step",
    name: "recommendedUiStep",
    value: options.draft.recommendedUiStep,
    min: "0.000001",
    step: "any"
  });

  const diagnostics = document.createElement("p");
  diagnostics.className = "create-parameter-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.parameterCreateSubmit;
  submit.disabled = options.disabled;
  submit.textContent = "Commit";

  form.append(displayName, min, max, defaultValue, recommendedUiStep, diagnostics, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readCreateParameterCommand(form, diagnostics);
    if (command !== null) {
      options.onSubmit(command);
    }
  });

  return form;
};

interface TextFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly required?: boolean;
}

interface NumberFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly value: number;
  readonly min?: string;
  readonly step: string;
}

const createTextField = (options: TextFieldOptions): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "editor-field editor-field--wide";
  label.textContent = options.label;

  const input = document.createElement("input");
  input.name = options.name;
  input.type = "text";
  input.value = options.value;
  input.required = options.required ?? false;
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

const readCreateParameterCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement
): EditorCreateParameterCommand | null => {
  const fields = new FormData(form);
  const displayName = String(fields.get("displayName") ?? "").trim();
  const min = toFiniteNumber(fields.get("min"));
  const max = toFiniteNumber(fields.get("max"));
  const defaultValue = toFiniteNumber(fields.get("defaultValue"));
  const recommendedUiStep = toFiniteNumber(fields.get("recommendedUiStep"));
  const validationMessage = validateCreateParameterInput({
    displayName,
    min,
    max,
    defaultValue,
    recommendedUiStep
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  diagnostics.textContent = "";

  return {
    displayName,
    min,
    max,
    defaultValue,
    recommendedUiStep
  };
};

const toFiniteNumber = (value: FormDataEntryValue | null): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const validateCreateParameterInput = (input: EditorCreateParameterCommand): string | null => {
  if (input.displayName.length === 0) {
    return "Display name is required.";
  }

  if (
    !Number.isFinite(input.min) ||
    !Number.isFinite(input.max) ||
    !Number.isFinite(input.defaultValue) ||
    !Number.isFinite(input.recommendedUiStep)
  ) {
    return "Numeric fields must contain finite values.";
  }

  if (input.min >= input.max) {
    return "Min must be lower than max.";
  }

  if (input.defaultValue < input.min || input.defaultValue > input.max) {
    return "Default must be inside the min/max range.";
  }

  if (input.recommendedUiStep <= 0) {
    return "Step must be greater than zero.";
  }

  return null;
};
