import type { EditorCreateDrawablePresetCommand } from "../../editor-session/index.js";
import {
  editorTestIds,
  type CreateDrawableFormState
} from "../../editor-state/index.js";

export interface DrawableAuthoringFormOptions {
  readonly disabled: boolean;
  readonly draft: CreateDrawableFormState;
  readonly onSubmit: (command: EditorCreateDrawablePresetCommand) => void;
}

export const createDrawableAuthoringForm = (
  options: DrawableAuthoringFormOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-drawable-form";
  form.dataset.testid = editorTestIds.drawableCreateForm;
  form.setAttribute("aria-label", "Create generated drawable");

  const displayName = createTextField({
    label: "Display name",
    name: "displayName",
    value: options.draft.displayName,
    required: true
  });
  const shapePreset = createSelectField({
    label: "Shape preset",
    name: "meshMethod",
    value: options.draft.meshMethod,
    options: [{ value: "auto-grid-v1", label: "Rectangle grid" }]
  });
  const x = createNumberField({ label: "X", name: "x", value: options.draft.initialBounds.x });
  const y = createNumberField({ label: "Y", name: "y", value: options.draft.initialBounds.y });
  const width = createNumberField({
    label: "Width",
    name: "width",
    value: options.draft.initialBounds.width,
    min: "0.000001"
  });
  const height = createNumberField({
    label: "Height",
    name: "height",
    value: options.draft.initialBounds.height,
    min: "0.000001"
  });

  const diagnostics = document.createElement("p");
  diagnostics.className = "create-drawable-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.drawableCreateSubmit;
  submit.disabled = options.disabled;
  submit.textContent = "Create drawable";

  form.append(displayName, shapePreset, x, y, width, height, diagnostics, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readCreateDrawableCommand(form, diagnostics, options);
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
}

interface SelectFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
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
  input.step = "any";
  if (options.min !== undefined) {
    input.min = options.min;
  }

  label.append(input);
  return label;
};

const createSelectField = (options: SelectFieldOptions): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "editor-field editor-field--wide";
  label.textContent = options.label;

  const select = document.createElement("select");
  select.name = options.name;
  select.value = options.value;

  for (const option of options.options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    select.append(item);
  }

  label.append(select);
  return label;
};

const readCreateDrawableCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement,
  options: DrawableAuthoringFormOptions
): EditorCreateDrawablePresetCommand | null => {
  if (options.disabled) {
    diagnostics.textContent = "Drawable authoring is unavailable for the current package.";
    return null;
  }

  const fields = new FormData(form);
  const displayName = String(fields.get("displayName") ?? "").trim();
  const meshMethod = String(fields.get("meshMethod") ?? options.draft.meshMethod);
  const initialBounds = {
    x: toFiniteNumber(fields.get("x")),
    y: toFiniteNumber(fields.get("y")),
    width: toFiniteNumber(fields.get("width")),
    height: toFiniteNumber(fields.get("height"))
  };
  const validationMessage = validateCreateDrawableInput({
    displayName,
    meshMethod,
    initialBounds
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  diagnostics.textContent = "";

  return {
    displayName,
    sourceAssetId: options.draft.sourceAssetId,
    ...(options.draft.sourceLayerId === null
      ? {}
      : { sourceLayerId: options.draft.sourceLayerId }),
    partId: options.draft.partId,
    initialBounds,
    meshMethod: "auto-grid-v1",
    densityHint: options.draft.densityHint
  };
};

const toFiniteNumber = (value: FormDataEntryValue | null): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const validateCreateDrawableInput = (input: {
  readonly displayName: string;
  readonly meshMethod: string;
  readonly initialBounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}): string | null => {
  if (input.displayName.length === 0) {
    return "Display name is required.";
  }

  if (input.meshMethod !== "auto-grid-v1") {
    return "Shape preset is not available.";
  }

  if (
    !Number.isFinite(input.initialBounds.x) ||
    !Number.isFinite(input.initialBounds.y) ||
    !Number.isFinite(input.initialBounds.width) ||
    !Number.isFinite(input.initialBounds.height)
  ) {
    return "Bounds must contain finite values.";
  }

  if (input.initialBounds.width <= 0 || input.initialBounds.height <= 0) {
    return "Bounds width and height must be greater than zero.";
  }

  return null;
};
