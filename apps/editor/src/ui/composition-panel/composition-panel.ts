import type { EditorPreviewProjectionDto } from "../../editor-preview/preview-dto.js";
import type {
  EditorViewerRuntimeProjection,
  EditorWorkflowAddDrawableOpacityKeyformCommand,
  EditorWorkflowSetMaskRelationCommand
} from "../../editor-workflow/index.js";
import {
  editorTestIds,
  type EditorSemanticState,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";

export interface CompositionPanelOptions {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly preview: EditorPreviewProjectionDto | null;
  readonly viewerRuntimeProjection: EditorViewerRuntimeProjection | null;
  readonly onCommitSetMaskRelation: (command: EditorWorkflowSetMaskRelationCommand) => void;
  readonly onCommitAddDrawableOpacityKeyform: (
    command: EditorWorkflowAddDrawableOpacityKeyformCommand
  ) => void;
}

export const createCompositionPanel = (
  options: CompositionPanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel composition-panel";
  panel.dataset.testid = editorTestIds.compositionPanel;
  panel.setAttribute("aria-labelledby", "editor-composition-heading");

  const heading = document.createElement("h2");
  heading.id = "editor-composition-heading";
  heading.textContent = "Composition / Mask / Opacity";

  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.composition.relationCountLabel;

  panel.append(
    heading,
    meta,
    createMaskRelationForm(options),
    createOpacityKeyformForm(options),
    createMaskRelationList(options),
    createOpacityKeyformList(options),
    createCompositionRuntimeEvidence(options),
    createCompositionStatus(options)
  );

  return panel;
};

const createMaskRelationForm = (
  options: CompositionPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-drawable-form";
  form.dataset.testid = editorTestIds.compositionMaskRelationForm;
  form.setAttribute("aria-label", "Commit semantic mask relation");

  const heading = document.createElement("h3");
  heading.className = "editor-field--wide";
  heading.textContent = "Mask relation";

  const relationId = createTextField({
    label: "Relation ID",
    name: "maskRelationId",
    value: options.viewModel.composition.defaultMaskRelationId,
    required: false,
    wide: true
  });
  const maskDrawables = createMultiSelectField({
    label: "Mask drawables",
    name: "maskDrawableIds",
    options: options.viewModel.composition.drawableOptions.map((drawable) => ({
      value: drawable.drawableId,
      label: `${drawable.label} / ${drawable.defaultOpacityLabel}`,
      selected: options.viewModel.composition.defaultMaskDrawableIds.includes(drawable.drawableId)
    }))
  });
  const targetDrawables = createMultiSelectField({
    label: "Target drawables",
    name: "targetDrawableIds",
    options: options.viewModel.composition.drawableOptions.map((drawable) => ({
      value: drawable.drawableId,
      label: `${drawable.label} / ${drawable.defaultOpacityLabel}`,
      selected: options.viewModel.composition.defaultTargetDrawableIds.includes(drawable.drawableId)
    }))
  });
  const enabled = createCheckboxField({
    label: "Enabled",
    name: "enabled",
    checked: options.viewModel.composition.defaultMaskRelationEnabled
  });
  const diagnostics = createDiagnosticsStatus(
    options.viewModel.composition.maskRelationDisabledMessage ?? ""
  );
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.compositionMaskRelationSubmit;
  submit.disabled = !options.viewModel.composition.canCommitMaskRelation;
  submit.textContent = "Commit mask relation";

  form.append(heading, relationId, maskDrawables, targetDrawables, enabled, diagnostics, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readSetMaskRelationCommand(form, diagnostics);
    if (command !== null) {
      options.onCommitSetMaskRelation(command);
    }
  });

  return form;
};

const createOpacityKeyformForm = (
  options: CompositionPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-drawable-form";
  form.dataset.testid = editorTestIds.compositionOpacityKeyformForm;
  form.setAttribute("aria-label", "Add drawable opacity keyform");

  const heading = document.createElement("h3");
  heading.className = "editor-field--wide";
  heading.textContent = "Opacity keyform";
  const parameter = createSelectField({
    label: "Input parameter",
    name: "parameterId",
    options: options.viewModel.composition.opacityParameterOptions.map((parameterOption) => ({
      value: parameterOption.parameterId,
      label: `${parameterOption.label} / ${parameterOption.rangeLabel}`
    }))
  });
  const drawable = createSelectField({
    label: "Drawable",
    name: "drawableId",
    options: options.viewModel.composition.drawableOptions.map((drawableOption) => ({
      value: drawableOption.drawableId,
      label: `${drawableOption.label} / ${drawableOption.defaultOpacityLabel}`
    }))
  });
  const keyValue = createNumberField({
    label: "Key value",
    name: "keyValue",
    value: 1,
    step: "any"
  });
  const opacity = createNumberField({
    label: "Opacity",
    name: "opacity",
    value: 0.5,
    step: "0.01",
    min: "0",
    max: "1"
  });
  const diagnostics = createDiagnosticsStatus(
    options.viewModel.composition.opacityKeyformDisabledMessage ?? ""
  );
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.compositionOpacityKeyformSubmit;
  submit.disabled = !options.viewModel.composition.canAddOpacityKeyform;
  submit.textContent = "Add opacity keyform";

  form.append(heading, parameter, drawable, keyValue, opacity, diagnostics, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readAddDrawableOpacityKeyformCommand(form, diagnostics, options);
    if (command !== null) {
      options.onCommitAddDrawableOpacityKeyform(command);
    }
  });

  return form;
};

const createMaskRelationList = (options: CompositionPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "rig-control-list";
  section.dataset.testid = editorTestIds.compositionMaskRelationList;

  const heading = document.createElement("h3");
  heading.textContent = "Mask relations";
  section.append(heading);

  if (!options.viewModel.composition.hasMaskRelations) {
    section.append(createEmpty("No mask relations"));
    return section;
  }

  for (const relation of options.viewModel.composition.maskRelations) {
    const item = document.createElement("article");
    item.className = "drawable-authoring-result";

    const title = document.createElement("h4");
    title.className = "drawable-authoring-result__label";
    title.textContent = relation.maskRelationId;

    const facts = document.createElement("dl");
    facts.className = "drawable-authoring-summary";
    appendFact(facts, "State", relation.enabledLabel);
    appendFact(facts, "Masks", relation.maskDrawableLabel);
    appendFact(facts, "Targets", relation.targetDrawableLabel);
    appendFact(facts, "Group", relation.maskGroupLabel);
    item.append(title, facts);
    section.append(item);
  }

  return section;
};

const createOpacityKeyformList = (options: CompositionPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "rig-control-list";
  section.dataset.testid = editorTestIds.compositionOpacityKeyformList;

  const heading = document.createElement("h3");
  heading.textContent = "Opacity keyforms";
  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.composition.opacityKeyformCountLabel;
  section.append(heading, meta);

  if (options.viewModel.composition.opacityKeyforms.length === 0) {
    section.append(createEmpty("No drawable opacity keyforms"));
    return section;
  }

  for (const keyform of options.viewModel.composition.opacityKeyforms) {
    const item = document.createElement("article");
    item.className = "drawable-authoring-result";

    const title = document.createElement("h4");
    title.className = "drawable-authoring-result__label";
    title.textContent = keyform.keyformSetId;

    const facts = document.createElement("dl");
    facts.className = "drawable-authoring-summary";
    appendFact(facts, "Target", keyform.targetLabel);
    appendFact(facts, "Parameter", keyform.parameterLabel);
    appendFact(facts, "Key value", keyform.keyValueLabel);
    appendFact(facts, "Opacity", keyform.opacityLabel);
    item.append(title, facts);
    section.append(item);
  }

  return section;
};

const createCompositionRuntimeEvidence = (
  options: CompositionPanelOptions
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "rig-control-evidence";
  section.dataset.testid = editorTestIds.compositionEvidence;

  const heading = document.createElement("h3");
  heading.textContent = "Runtime Evidence";
  section.append(
    heading,
    createPreviewCompositionEvidence(options),
    createViewerCompositionEvidence(options.viewerRuntimeProjection)
  );
  return section;
};

const createPreviewCompositionEvidence = (
  options: CompositionPanelOptions
): HTMLElement => {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  heading.textContent = "Preview";
  section.append(heading);

  if (options.preview === null) {
    section.append(createEmpty("No preview composition evidence"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  list.append(createListItem(`snapshot ${options.preview.sourceSnapshotId}; ${options.state.maskRelations.length} authored mask relation${options.state.maskRelations.length === 1 ? "" : "s"}`));
  for (const relation of options.state.maskRelations) {
    list.append(createListItem(`${relation.maskRelationId}: semanticClipping / ${relation.enabled ? "enabled" : "disabled"}; masks ${relation.maskDrawableIds.join(", ") || "None"}; targets ${relation.targetDrawableIds.join(", ") || "None"}`));
  }
  for (const drawable of options.preview.drawables) {
    list.append(createListItem(`${drawable.drawableId}: opacity ${formatPanelNumber(drawable.opacity)} / ${drawable.visible ? "visible" : "hidden"}`));
  }
  section.append(list);
  return section;
};

const createViewerCompositionEvidence = (
  projection: EditorViewerRuntimeProjection | null
): HTMLElement => {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  heading.textContent = "Viewer";
  section.append(heading);

  if (projection === null) {
    section.append(createEmpty("Open Viewer / Runtime for viewer composition evidence"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  list.append(createListItem(`snapshot ${projection.snapshotSummary.snapshotId}; ${projection.snapshotSummary.maskRelationCount} mask relation${projection.snapshotSummary.maskRelationCount === 1 ? "" : "s"}`));
  for (const relation of projection.snapshotSummary.maskRelations) {
    list.append(createListItem(`${relation.maskRelationId}: ${relation.clippingIntent} / ${relation.resolvedLabel}; masks ${relation.sourceDrawableLabel}; targets ${relation.targetDrawableLabel}`));
  }
  for (const drawable of projection.snapshotSummary.drawableOpacityEvidence) {
    list.append(createListItem(`${drawable.drawableId}: opacity ${formatPanelNumber(drawable.opacity)} / ${drawable.visible ? "visible" : "hidden"}`));
  }
  section.append(list);
  return section;
};

const createCompositionStatus = (options: CompositionPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "rig-control-status";
  section.dataset.testid = editorTestIds.compositionDiagnostics;

  const heading = document.createElement("h3");
  heading.textContent = "Operation Diagnostics";

  const summary = document.createElement("p");
  summary.className = "editor-panel__meta";
  summary.textContent = options.viewModel.composition.lastCompositionOperationLabel;
  section.append(heading, summary);

  if (options.viewModel.composition.lastCompositionDiagnostics.length === 0) {
    section.append(createEmpty("No composition diagnostics"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-validator-diagnostics__list";
  for (const diagnostic of options.viewModel.composition.lastCompositionDiagnostics) {
    const item = document.createElement("li");
    item.textContent = `${diagnostic.severity} / ${diagnostic.checkId}: ${diagnostic.message}`;
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
  readonly step: string;
  readonly min?: string;
  readonly max?: string;
}

interface SelectFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

interface MultiSelectFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
    readonly selected: boolean;
  }[];
}

interface CheckboxFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly checked: boolean;
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
  if (options.max !== undefined) {
    input.max = options.max;
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
    select.append(optionElement);
  }
  label.append(select);
  return label;
};

const createMultiSelectField = (options: MultiSelectFieldOptions): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "editor-field";
  label.textContent = options.label;

  const select = document.createElement("select");
  select.name = options.name;
  select.multiple = true;
  select.size = Math.min(Math.max(options.options.length, 2), 5);
  for (const option of options.options) {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    optionElement.selected = option.selected;
    select.append(optionElement);
  }
  label.append(select);
  return label;
};

const createCheckboxField = (options: CheckboxFieldOptions): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "source-intake-form__checkbox";

  const input = document.createElement("input");
  input.name = options.name;
  input.type = "checkbox";
  input.checked = options.checked;

  const text = document.createElement("span");
  text.textContent = options.label;
  label.append(input, text);
  return label;
};

const createDiagnosticsStatus = (text: string): HTMLElement => {
  const diagnostics = document.createElement("p");
  diagnostics.className = "create-drawable-form__diagnostics";
  diagnostics.setAttribute("role", "status");
  diagnostics.textContent = text;
  return diagnostics;
};

const readSetMaskRelationCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement
): EditorWorkflowSetMaskRelationCommand | null => {
  const fields = new FormData(form);
  const maskRelationId = String(fields.get("maskRelationId") ?? "").trim();
  const maskDrawableIds = readStringList(fields, "maskDrawableIds");
  const targetDrawableIds = readStringList(fields, "targetDrawableIds");
  const enabled = fields.get("enabled") === "on";
  const validationMessage = validateSetMaskRelationInput({
    maskRelationId,
    maskDrawableIds,
    targetDrawableIds
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  diagnostics.textContent = "";
  return {
    ...(maskRelationId.length === 0 ? {} : { maskRelationId }),
    maskDrawableIds,
    targetDrawableIds,
    enabled
  };
};

const readAddDrawableOpacityKeyformCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement,
  options: CompositionPanelOptions
): EditorWorkflowAddDrawableOpacityKeyformCommand | null => {
  const fields = new FormData(form);
  const parameterId = String(fields.get("parameterId") ?? "").trim();
  const drawableId = String(fields.get("drawableId") ?? "").trim();
  const keyValue = toFiniteNumber(fields.get("keyValue"));
  const opacity = toFiniteNumber(fields.get("opacity"));
  const validationMessage = validateAddDrawableOpacityKeyformInput({
    state: options.state,
    viewModel: options.viewModel,
    parameterId,
    drawableId,
    keyValue,
    opacity
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  diagnostics.textContent = "";
  return {
    parameterId,
    drawableId,
    keyValue,
    opacity
  };
};

const validateSetMaskRelationInput = (input: {
  readonly maskRelationId: string;
  readonly maskDrawableIds: readonly string[];
  readonly targetDrawableIds: readonly string[];
}): string | null => {
  if (input.maskRelationId.length > 0 && !/^maskrel_[A-Za-z0-9_-]+$/.test(input.maskRelationId)) {
    return "Relation ID must use the maskrel_ prefix and ID-safe characters.";
  }

  if (input.maskDrawableIds.length === 0 || input.targetDrawableIds.length === 0) {
    return "At least one mask drawable and one target drawable are required.";
  }

  const overlap = input.maskDrawableIds.find((drawableId) =>
    input.targetDrawableIds.includes(drawableId)
  );
  if (overlap !== undefined) {
    return `Drawable cannot be both mask and target: ${overlap}.`;
  }

  return null;
};

const validateAddDrawableOpacityKeyformInput = (input: {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly parameterId: string;
  readonly drawableId: string;
  readonly keyValue: number;
  readonly opacity: number;
}): string | null => {
  const parameterOptions = input.viewModel.composition.opacityParameterOptions;
  const drawableOptions = input.viewModel.composition.drawableOptions;

  if (parameterOptions.length === 0) {
    return "No authored input parameter available.";
  }

  if (drawableOptions.length === 0) {
    return "No drawable available.";
  }

  if (input.parameterId.length === 0 || input.drawableId.length === 0) {
    return "Parameter and drawable are required.";
  }

  if (!parameterOptions.some((option) => option.parameterId === input.parameterId)) {
    return "Selected parameter must be an authored input parameter.";
  }

  if (!input.state.drawables.some((drawable) => drawable.drawableId === input.drawableId)) {
    return "Selected drawable is unavailable.";
  }

  if (!Number.isFinite(input.keyValue) || !Number.isFinite(input.opacity)) {
    return "Key value and opacity must contain finite values.";
  }

  if (input.opacity < 0 || input.opacity > 1) {
    return "Opacity must be between 0 and 1.";
  }

  return null;
};

const readStringList = (fields: FormData, name: string): readonly string[] =>
  uniqueStrings(fields.getAll(name).map((value) => String(value).trim()).filter(Boolean));

const createListItem = (text: string): HTMLLIElement => {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
};

const appendFact = (list: HTMLDListElement, label: string, value: string): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;
  list.append(term, description);
};

const createEmpty = (text: string): HTMLElement => {
  const empty = document.createElement("p");
  empty.className = "preview-panel__empty";
  empty.textContent = text;
  return empty;
};

const toFiniteNumber = (value: FormDataEntryValue | null): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const uniqueStrings = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
};

const formatPanelNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : Number.parseFloat(value.toFixed(4)).toString();
