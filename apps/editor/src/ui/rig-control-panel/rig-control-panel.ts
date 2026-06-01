import type { EditorPreviewProjectionDto } from "../../editor-preview/preview-dto.js";
import type {
  EditorViewerRuntimeProjection,
  EditorWorkflowBindRigControlChildCommand,
  EditorWorkflowCreateRotation2dRigControlCommand
} from "../../editor-workflow/index.js";
import {
  createRigControlRowTestId,
  editorTestIds,
  type EditorSemanticState,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";

export interface RigControlPanelOptions {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly preview: EditorPreviewProjectionDto | null;
  readonly viewerRuntimeProjection: EditorViewerRuntimeProjection | null;
  readonly onCommitCreateRotation2dRigControl: (
    command: EditorWorkflowCreateRotation2dRigControlCommand
  ) => void;
  readonly onCommitBindRigControlChild: (
    command: EditorWorkflowBindRigControlChildCommand
  ) => void;
}

export const createRigControlPanel = (
  options: RigControlPanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel rig-control-panel";
  panel.dataset.testid = editorTestIds.rigControlPanel;
  panel.setAttribute("aria-labelledby", "editor-rig-control-heading");

  const heading = document.createElement("h2");
  heading.id = "editor-rig-control-heading";
  heading.textContent = "Project-defined Rig Controls";

  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.rigControls.controlCountLabel;

  panel.append(
    heading,
    meta,
    createRigControlCreateForm(options),
    createRigControlBindForm(options),
    createRigControlList(options),
    createRigControlRuntimeEvidence(options),
    createRigControlStatus(options)
  );

  return panel;
};

const createRigControlCreateForm = (
  options: RigControlPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-drawable-form";
  form.dataset.testid = editorTestIds.rigControlCreateForm;
  form.setAttribute("aria-label", "Create project-defined rotation2d rig control");

  const heading = document.createElement("h3");
  heading.className = "editor-field--wide";
  heading.textContent = "Create rotation2d";

  const displayName = createTextField({
    label: "Control name",
    name: "displayName",
    value: "Body Rotation",
    required: true,
    wide: true
  });
  const part = createSelectField({
    label: "Part",
    name: "partId",
    options: options.viewModel.rigControls.partOptions.map((partOption) => ({
      value: partOption.partId,
      label: partOption.label
    }))
  });
  const pivotX = createNumberField({
    label: "Pivot X",
    name: "pivotX",
    value: options.viewModel.rigControls.defaultPivotX,
    step: "any"
  });
  const pivotY = createNumberField({
    label: "Pivot Y",
    name: "pivotY",
    value: options.viewModel.rigControls.defaultPivotY,
    step: "any"
  });
  const restAngle = createNumberField({
    label: "Rest angle",
    name: "restAngleDegrees",
    value: options.viewModel.rigControls.defaultRestAngleDegrees,
    step: "any"
  });
  const diagnostics = createDiagnosticsStatus(
    options.viewModel.rigControls.createDisabledMessage ?? ""
  );
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.rigControlCreateSubmit;
  submit.disabled = !options.viewModel.rigControls.canCreateRotation2d;
  submit.textContent = "Create rotation control";

  form.append(heading, displayName, part, pivotX, pivotY, restAngle, diagnostics, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readCreateRotation2dRigControlCommand(form, diagnostics);
    if (command !== null) {
      options.onCommitCreateRotation2dRigControl(command);
    }
  });

  return form;
};

const createRigControlBindForm = (
  options: RigControlPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-drawable-form";
  form.dataset.testid = editorTestIds.rigControlBindForm;
  form.setAttribute("aria-label", "Bind drawable or child rig control to a project-defined rig control");

  const heading = document.createElement("h3");
  heading.className = "editor-field--wide";
  heading.textContent = "Bind child";
  const parent = createSelectField({
    label: "Parent control",
    name: "parentRigControlId",
    options: options.viewModel.rigControls.parentOptions.map((parentOption) => ({
      value: parentOption.id,
      label: parentOption.label
    }))
  });
  const child = createSelectField({
    label: "Child target",
    name: "childTarget",
    options: options.viewModel.rigControls.childOptions.map((childOption) => ({
      value: `${childOption.kind}:${childOption.id}`,
      label: childOption.label
    }))
  });
  const diagnostics = createDiagnosticsStatus(
    options.viewModel.rigControls.bindDisabledMessage ?? ""
  );
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.rigControlBindSubmit;
  submit.disabled = !options.viewModel.rigControls.canBindChild;
  submit.textContent = "Bind child";

  form.append(heading, parent, child, diagnostics, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readBindRigControlChildCommand(form, diagnostics);
    if (command !== null) {
      options.onCommitBindRigControlChild(command);
    }
  });

  return form;
};

const createRigControlList = (options: RigControlPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "rig-control-list";
  section.dataset.testid = editorTestIds.rigControlList;

  const heading = document.createElement("h3");
  heading.textContent = "Controls";
  section.append(heading);

  if (!options.viewModel.rigControls.hasRigControls) {
    section.append(createEmpty("No project-defined rig controls"));
    return section;
  }

  for (const rigControl of options.viewModel.rigControls.rigControls) {
    const item = document.createElement("article");
    item.className = "drawable-authoring-result";
    item.dataset.testid = createRigControlRowTestId(rigControl.rigControlId);

    const title = document.createElement("h4");
    title.className = "drawable-authoring-result__label";
    title.textContent = rigControl.displayName;

    const facts = document.createElement("dl");
    facts.className = "drawable-authoring-summary";
    appendFact(facts, "ID", rigControl.rigControlId);
    appendFact(facts, "Kind", rigControl.kindLabel);
    appendFact(facts, "State", rigControl.enabledLabel);
    appendFact(facts, "Part", rigControl.partLabel);
    appendFact(facts, "Parent", rigControl.parentLabel);
    appendFact(facts, "Drawable children", rigControl.childDrawableLabel);
    appendFact(facts, "Child controls", rigControl.childRigControlLabel);
    appendFact(facts, "Transform", rigControl.transformLabel);
    item.append(title, facts);
    section.append(item);
  }

  return section;
};

const createRigControlRuntimeEvidence = (
  options: RigControlPanelOptions
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "rig-control-evidence";
  section.dataset.testid = editorTestIds.rigControlEvidence;

  const heading = document.createElement("h3");
  heading.textContent = "Runtime Evidence";
  section.append(heading);
  section.append(createPreviewRigControlEvidence(options));
  section.append(createViewerRigControlEvidence(options.viewerRuntimeProjection));
  return section;
};

const createPreviewRigControlEvidence = (
  options: RigControlPanelOptions
): HTMLElement => {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  heading.textContent = "Preview";
  section.append(heading);

  if (options.state.rigControls.length === 0) {
    section.append(createEmpty("No preview rig control affected targets"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  const previewLabel = options.preview === null
    ? "preview not projected"
    : `preview ${options.preview.sourceSnapshotId}`;
  for (const rigControl of options.state.rigControls) {
    const item = document.createElement("li");
    item.textContent = `${rigControl.rigControlId}: ${rigControl.kind} / ${previewLabel}; rest ${formatOptionalNumber(rigControl.restAngleDegrees)}; drawable children ${rigControl.childDrawableIds.join(", ") || "None"}; child controls ${rigControl.childRigControlIds.join(", ") || "None"}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createViewerRigControlEvidence = (
  projection: EditorViewerRuntimeProjection | null
): HTMLElement => {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  heading.textContent = "Viewer";
  section.append(heading);

  if (projection === null || projection.snapshotSummary.rigControls.length === 0) {
    section.append(createEmpty("Open Viewer / Runtime for viewer rig control evidence"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-preview-outputs__list";
  for (const rigControl of projection.snapshotSummary.rigControls) {
    const item = document.createElement("li");
    item.textContent = `${rigControl.rigControlId}: ${rigControl.evaluationStatus} / order ${rigControl.hierarchyIndex}; local ${rigControl.localAngleLabel} / world ${rigControl.worldAngleLabel}; affected ${rigControl.affectedDrawableLabel}`;
    list.append(item);
  }
  section.append(list);
  return section;
};

const createRigControlStatus = (options: RigControlPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "rig-control-status";
  section.dataset.testid = editorTestIds.rigControlDiagnostics;

  const heading = document.createElement("h3");
  heading.textContent = "Operation Diagnostics";

  const summary = document.createElement("p");
  summary.className = "editor-panel__meta";
  summary.textContent = options.viewModel.rigControls.lastRigControlOperationLabel;
  section.append(heading, summary);

  if (options.viewModel.rigControls.lastRigControlDiagnostics.length === 0) {
    section.append(createEmpty("No rig control diagnostics"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "dynamics-validator-diagnostics__list";
  for (const diagnostic of options.viewModel.rigControls.lastRigControlDiagnostics) {
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
}

interface SelectFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
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

const createDiagnosticsStatus = (text: string): HTMLElement => {
  const diagnostics = document.createElement("p");
  diagnostics.className = "create-drawable-form__diagnostics";
  diagnostics.setAttribute("role", "status");
  diagnostics.textContent = text;
  return diagnostics;
};

const readCreateRotation2dRigControlCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement
): EditorWorkflowCreateRotation2dRigControlCommand | null => {
  const fields = new FormData(form);
  const displayName = String(fields.get("displayName") ?? "").trim();
  const partId = String(fields.get("partId") ?? "").trim();
  const pivotX = toFiniteNumber(fields.get("pivotX"));
  const pivotY = toFiniteNumber(fields.get("pivotY"));
  const restAngleDegrees = toFiniteNumber(fields.get("restAngleDegrees"));
  const validationMessage = validateCreateRotation2dInput({
    displayName,
    partId,
    pivotX,
    pivotY,
    restAngleDegrees
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  diagnostics.textContent = "";
  return {
    displayName,
    partId,
    pivot: { x: pivotX, y: pivotY },
    restAngleDegrees
  };
};

const readBindRigControlChildCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement
): EditorWorkflowBindRigControlChildCommand | null => {
  const fields = new FormData(form);
  const parentRigControlId = String(fields.get("parentRigControlId") ?? "").trim();
  const childTarget = String(fields.get("childTarget") ?? "").trim();
  const child = parseChildTarget(childTarget);

  if (parentRigControlId.length === 0 || child === null) {
    diagnostics.textContent = "Parent and child are required.";
    return null;
  }

  if (child.kind === "rigControl" && child.id === parentRigControlId) {
    diagnostics.textContent = "Parent rig control cannot be bound to itself.";
    return null;
  }

  diagnostics.textContent = "";
  return {
    parentRigControlId,
    child
  };
};

const validateCreateRotation2dInput = (input: {
  readonly displayName: string;
  readonly partId: string;
  readonly pivotX: number;
  readonly pivotY: number;
  readonly restAngleDegrees: number;
}): string | null => {
  if (input.displayName.length === 0) {
    return "Control name is required.";
  }

  if (input.partId.length === 0) {
    return "Part is required.";
  }

  if (!Number.isFinite(input.pivotX) || !Number.isFinite(input.pivotY) || !Number.isFinite(input.restAngleDegrees)) {
    return "Pivot and rest angle must contain finite values.";
  }

  return null;
};

const parseChildTarget = (
  value: string
): EditorWorkflowBindRigControlChildCommand["child"] | null => {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  const kind = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  if ((kind !== "drawable" && kind !== "rigControl") || id.length === 0) {
    return null;
  }

  return { kind, id };
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

const formatOptionalNumber = (value: number | null): string =>
  value === null ? "n/a" : Number.isInteger(value) ? String(value) : Number.parseFloat(value.toFixed(4)).toString();
