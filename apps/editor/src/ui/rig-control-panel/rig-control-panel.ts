import type { EditorPreviewProjectionDto } from "../../editor-preview/preview-dto.js";
import type {
  EditorWorkflowAddRigControlAngleKeyformCommand,
  EditorViewerRuntimeProjection,
  EditorWorkflowBindRigControlChildCommand,
  EditorWorkflowCreateRotation2dRigControlCommand
} from "../../editor-workflow/index.js";
import {
  createRigControlRowTestId,
  editorTestIds,
  projectMinimumWarpLattice2dRestControlPoints,
  type EditorSemanticState,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";

export interface RigControlWarpLattice2dCreateDraftCommand {
  readonly commandKind: "draftWarpLattice2dRigControl";
  readonly draftRigControlId: string;
  readonly displayName: string;
  readonly partId: string;
  readonly bindSpace: "rigControlLocalRest";
  readonly domainBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly latticeColumns: 2;
  readonly latticeRows: 2;
  readonly restControlPoints: readonly { readonly x: number; readonly y: number }[];
  readonly interpolationMethod: "bilinear-grid-v1";
}

export interface RigControlWarpLattice2dBindChildDraftCommand {
  readonly commandKind: "draftWarpLattice2dBindChild";
  readonly parent: {
    readonly source: "draft" | "package";
    readonly id: string;
  };
  readonly child: EditorWorkflowBindRigControlChildCommand["child"];
}

export interface RigControlWarpLattice2dControlPointOffsetsKeyformDraftCommand {
  readonly commandKind: "draftWarpLattice2dControlPointOffsetsKeyform";
  readonly target: {
    readonly source: "draft" | "package";
    readonly id: string;
    readonly property: "controlPointOffsets";
  };
  readonly parameterId: string;
  readonly keyValue: number;
  readonly compositionMode: "replace" | "additiveDelta";
  readonly controlPointOffsets: readonly { readonly x: number; readonly y: number }[];
}

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
  readonly onDraftCreateWarpLattice2dRigControl?: (
    command: RigControlWarpLattice2dCreateDraftCommand
  ) => void;
  readonly onDraftBindWarpLattice2dChild?: (
    command: RigControlWarpLattice2dBindChildDraftCommand
  ) => void;
  readonly onDraftAddWarpLattice2dControlPointOffsetsKeyform?: (
    command: RigControlWarpLattice2dControlPointOffsetsKeyformDraftCommand
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
    createWarpLattice2dCreateDraftForm(options),
    createRigControlBindForm(options),
    createWarpLattice2dBindDraftForm(options),
    createRigControlAngleKeyformForm(options),
    createWarpLattice2dControlPointOffsetsKeyformDraftForm(options),
    createRigControlList(options),
    createRigControlAngleKeyformList(options),
    createWarpLattice2dControlPointOffsetsKeyformList(options),
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

const createWarpLattice2dCreateDraftForm = (
  options: RigControlPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-drawable-form";
  form.dataset.testid = editorTestIds.rigControlWarpLatticeCreateDraftForm;
  form.setAttribute("aria-label", "Draft minimum 2x2 warpLattice2d rig control");

  const draft = options.viewModel.rigControls.warpLatticeDraft;
  const heading = document.createElement("h3");
  heading.className = "editor-field--wide";
  heading.textContent = "Draft 2x2 warpLattice2d";

  const scope = createDiagnosticsStatus(draft.scopeLabel);
  const draftRigControlId = createTextField({
    label: "Draft control ID",
    name: "draftRigControlId",
    value: draft.draftRigControlId,
    required: true,
    wide: true
  });
  const displayName = createTextField({
    label: "Control name",
    name: "displayName",
    value: draft.displayName,
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
  const domainX = createNumberField({
    label: "Domain X",
    name: "domainX",
    value: draft.domainBounds.x,
    step: "any"
  });
  const domainY = createNumberField({
    label: "Domain Y",
    name: "domainY",
    value: draft.domainBounds.y,
    step: "any"
  });
  const domainWidth = createNumberField({
    label: "Domain width",
    name: "domainWidth",
    value: draft.domainBounds.width,
    step: "any"
  });
  const domainHeight = createNumberField({
    label: "Domain height",
    name: "domainHeight",
    value: draft.domainBounds.height,
    step: "any"
  });
  const fixedShape = createDiagnosticsStatus(
    `Fixed ${draft.latticeSizeLabel} / ${draft.interpolationLabel} / ${draft.bindSpaceLabel}`
  );
  const diagnostics = createDiagnosticsStatus(
    options.viewModel.rigControls.warpLatticeCreateDraftDisabledMessage ?? ""
  );
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.rigControlWarpLatticeCreateDraftSubmit;
  submit.disabled = !options.viewModel.rigControls.canCreateWarpLattice2dDraft;
  submit.textContent = "Stage warp draft";

  form.append(
    heading,
    scope,
    draftRigControlId,
    displayName,
    part,
    domainX,
    domainY,
    domainWidth,
    domainHeight,
    fixedShape,
    diagnostics,
    submit
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readDraftWarpLattice2dRigControlCommand(form, diagnostics, options);
    if (command === null) {
      return;
    }

    options.onDraftCreateWarpLattice2dRigControl?.(command);
    if (options.onDraftCreateWarpLattice2dRigControl === undefined) {
      diagnostics.textContent = "Warp lattice draft validated; operation commit wiring is future scope.";
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

const createWarpLattice2dBindDraftForm = (
  options: RigControlPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-drawable-form";
  form.dataset.testid = editorTestIds.rigControlWarpLatticeBindDraftForm;
  form.setAttribute("aria-label", "Draft child binding for minimum warpLattice2d");

  const heading = document.createElement("h3");
  heading.className = "editor-field--wide";
  heading.textContent = "Draft warp child binding";
  const parent = createSelectField({
    label: "Warp parent",
    name: "warpParentTarget",
    options: options.viewModel.rigControls.warpLatticeTargetOptions.map((parentOption) => ({
      value: `${parentOption.source}:${parentOption.id}`,
      label: parentOption.label
    }))
  });
  const child = createSelectField({
    label: "Child target",
    name: "childTarget",
    options: options.viewModel.rigControls.warpLatticeChildOptions.map((childOption) => ({
      value: `${childOption.kind}:${childOption.id}`,
      label: childOption.label
    }))
  });
  const diagnostics = createDiagnosticsStatus(
    options.viewModel.rigControls.warpLatticeBindDraftDisabledMessage ?? ""
  );
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.rigControlWarpLatticeBindDraftSubmit;
  submit.disabled = !options.viewModel.rigControls.canDraftWarpLattice2dBindChild;
  submit.textContent = "Stage warp bind";

  form.append(heading, parent, child, diagnostics, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readDraftWarpLattice2dBindChildCommand(form, diagnostics, options);
    if (command === null) {
      return;
    }

    options.onDraftBindWarpLattice2dChild?.(command);
    if (options.onDraftBindWarpLattice2dChild === undefined) {
      diagnostics.textContent = "Warp lattice bind draft validated; operation commit wiring is future scope.";
    }
  });

  return form;
};

const createRigControlAngleKeyformForm = (
  options: RigControlPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-drawable-form";
  form.dataset.testid = editorTestIds.rigControlKeyformForm;
  form.setAttribute("aria-label", "Add rotation2d angle keyform");

  const heading = document.createElement("h3");
  heading.className = "editor-field--wide";
  heading.textContent = "Add angle keyform";
  const parameter = createSelectField({
    label: "Input parameter",
    name: "parameterId",
    options: options.viewModel.rigControls.angleKeyformParameterOptions.map((parameterOption) => ({
      value: parameterOption.parameterId,
      label: `${parameterOption.label} / ${parameterOption.rangeLabel}`
    }))
  });
  const rigControl = createSelectField({
    label: "Rotation control",
    name: "rigControlId",
    options: options.viewModel.rigControls.angleKeyformRigControlOptions.map((rigControlOption) => ({
      value: rigControlOption.id,
      label: rigControlOption.label
    }))
  });
  const keyValue = createNumberField({
    label: "Key value",
    name: "keyValue",
    value: 1,
    step: "any"
  });
  const angle = createNumberField({
    label: "Angle patch",
    name: "angleDegrees",
    value: 30,
    step: "any"
  });
  const diagnostics = createDiagnosticsStatus(
    options.viewModel.rigControls.angleKeyformDisabledMessage ?? ""
  );
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.rigControlKeyformSubmit;
  submit.disabled = !options.viewModel.rigControls.canCreateAngleKeyform;
  submit.textContent = "Add angle keyform";

  form.append(heading, parameter, rigControl, keyValue, angle, diagnostics, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readAddRigControlAngleKeyformCommand(form, diagnostics, options);
    if (command !== null) {
      options.onCommitCreateRotation2dRigControl(command);
    }
  });

  return form;
};

const createWarpLattice2dControlPointOffsetsKeyformDraftForm = (
  options: RigControlPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "create-drawable-form";
  form.dataset.testid = editorTestIds.rigControlWarpLatticeKeyformDraftForm;
  form.setAttribute("aria-label", "Draft warpLattice2d controlPointOffsets keyform");

  const draft = options.viewModel.rigControls.warpLatticeDraft;
  const heading = document.createElement("h3");
  heading.className = "editor-field--wide";
  heading.textContent = "Draft controlPointOffsets keyform";
  const parameter = createSelectField({
    label: "Input parameter",
    name: "parameterId",
    options: options.viewModel.rigControls.angleKeyformParameterOptions.map((parameterOption) => ({
      value: parameterOption.parameterId,
      label: `${parameterOption.label} / ${parameterOption.rangeLabel}`
    }))
  });
  const rigControl = createSelectField({
    label: "Warp target",
    name: "warpTarget",
    options: options.viewModel.rigControls.warpLatticeTargetOptions.map((targetOption) => ({
      value: `${targetOption.source}:${targetOption.id}`,
      label: targetOption.label
    }))
  });
  const keyValue = createNumberField({
    label: "Key value",
    name: "keyValue",
    value: draft.keyValue,
    step: "any"
  });
  const compositionMode = createSelectField({
    label: "Patch mode",
    name: "compositionMode",
    options: [
      { value: "replace", label: "replace" },
      { value: "additiveDelta", label: "additiveDelta" }
    ]
  });
  const pointFields = draft.controlPoints.map((point) =>
    createControlPointOffsetFieldset(point)
  );
  const diagnostics = createDiagnosticsStatus(
    options.viewModel.rigControls.warpLatticeKeyformDraftDisabledMessage ?? ""
  );
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.rigControlWarpLatticeKeyformDraftSubmit;
  submit.disabled = !options.viewModel.rigControls.canCreateWarpLattice2dKeyformDraft;
  submit.textContent = "Stage offset keyform";

  form.append(
    heading,
    createDiagnosticsStatus(`${draft.scopeLabel}; property ${draft.targetProperty}`),
    parameter,
    rigControl,
    keyValue,
    compositionMode,
    ...pointFields,
    diagnostics,
    submit
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = readDraftWarpLattice2dControlPointOffsetsKeyformCommand(
      form,
      diagnostics,
      options
    );
    if (command === null) {
      return;
    }

    options.onDraftAddWarpLattice2dControlPointOffsetsKeyform?.(command);
    if (options.onDraftAddWarpLattice2dControlPointOffsetsKeyform === undefined) {
      diagnostics.textContent = "Warp lattice keyform draft validated; operation commit wiring is future scope.";
    }
  });

  return form;
};

const createControlPointOffsetFieldset = (
  point: EditorWorkflowViewModel["rigControls"]["warpLatticeDraft"]["controlPoints"][number]
): HTMLElement => {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "editor-field editor-field--wide";

  const legend = document.createElement("legend");
  legend.textContent = `Point ${point.index} (${point.column}, ${point.row}) rest ${point.restLabel}`;
  fieldset.append(
    legend,
    createNumberField({
      label: "Offset X",
      name: point.offsetXName,
      value: point.offsetX,
      step: "any"
    }),
    createNumberField({
      label: "Offset Y",
      name: point.offsetYName,
      value: point.offsetY,
      step: "any"
    })
  );

  return fieldset;
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

const createRigControlAngleKeyformList = (options: RigControlPanelOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "rig-control-list";
  section.dataset.testid = editorTestIds.rigControlKeyformList;

  const heading = document.createElement("h3");
  heading.textContent = "Angle keyforms";
  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.rigControls.angleKeyformCountLabel;
  section.append(heading, meta);

  if (options.viewModel.rigControls.angleKeyforms.length === 0) {
    section.append(createEmpty("No rig control angle keyforms"));
    return section;
  }

  for (const keyform of options.viewModel.rigControls.angleKeyforms) {
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
    appendFact(facts, "Angle", keyform.angleLabel);
    item.append(title, facts);
    section.append(item);
  }

  return section;
};

const createWarpLattice2dControlPointOffsetsKeyformList = (
  options: RigControlPanelOptions
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "rig-control-list";
  section.dataset.testid = editorTestIds.rigControlWarpLatticeKeyformList;

  const heading = document.createElement("h3");
  heading.textContent = "Warp lattice keyforms";
  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.rigControls.warpLatticeKeyformCountLabel;
  section.append(heading, meta);

  if (options.viewModel.rigControls.warpLatticeKeyforms.length === 0) {
    section.append(createEmpty("No controlPointOffsets draft keyforms"));
    return section;
  }

  for (const keyform of options.viewModel.rigControls.warpLatticeKeyforms) {
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
    appendFact(facts, "Patch mode", keyform.compositionLabel);
    appendFact(facts, "Offsets", keyform.offsetsLabel);
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
    item.textContent = `${rigControl.rigControlId}: ${rigControl.kind} / ${previewLabel}; ${formatRigControlDraftKeyformEvidence(options.state, rigControl)}; drawable children ${rigControl.childDrawableIds.join(", ") || "None"}; child controls ${rigControl.childRigControlIds.join(", ") || "None"}`;
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

const readDraftWarpLattice2dRigControlCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement,
  options: RigControlPanelOptions
): RigControlWarpLattice2dCreateDraftCommand | null => {
  const fields = new FormData(form);
  const draftRigControlId = String(fields.get("draftRigControlId") ?? "").trim();
  const displayName = String(fields.get("displayName") ?? "").trim();
  const partId = String(fields.get("partId") ?? "").trim();
  const domainBounds = {
    x: toFiniteNumber(fields.get("domainX")),
    y: toFiniteNumber(fields.get("domainY")),
    width: toFiniteNumber(fields.get("domainWidth")),
    height: toFiniteNumber(fields.get("domainHeight"))
  };
  const validationMessage = validateDraftWarpLattice2dRigControlInput({
    viewModel: options.viewModel,
    draftRigControlId,
    displayName,
    partId,
    domainBounds
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  diagnostics.textContent = "";
  return {
    commandKind: "draftWarpLattice2dRigControl",
    draftRigControlId,
    displayName,
    partId,
    bindSpace: "rigControlLocalRest",
    domainBounds,
    latticeColumns: 2,
    latticeRows: 2,
    restControlPoints: projectMinimumWarpLattice2dRestControlPoints(domainBounds),
    interpolationMethod: "bilinear-grid-v1"
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

const readDraftWarpLattice2dBindChildCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement,
  options: RigControlPanelOptions
): RigControlWarpLattice2dBindChildDraftCommand | null => {
  const fields = new FormData(form);
  const parent = parseWarpLatticeTarget(String(fields.get("warpParentTarget") ?? "").trim());
  const child = parseChildTarget(String(fields.get("childTarget") ?? "").trim());
  const validationMessage = validateDraftWarpLattice2dBindChildInput({
    state: options.state,
    viewModel: options.viewModel,
    parent,
    child
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  if (parent === null || child === null) {
    return null;
  }

  diagnostics.textContent = "";
  return {
    commandKind: "draftWarpLattice2dBindChild",
    parent,
    child
  };
};

const readAddRigControlAngleKeyformCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement,
  options: RigControlPanelOptions
): EditorWorkflowAddRigControlAngleKeyformCommand | null => {
  const fields = new FormData(form);
  const parameterId = String(fields.get("parameterId") ?? "").trim();
  const rigControlId = String(fields.get("rigControlId") ?? "").trim();
  const keyValue = toFiniteNumber(fields.get("keyValue"));
  const angleDegrees = toFiniteNumber(fields.get("angleDegrees"));
  const validationMessage = validateAddRigControlAngleKeyformInput({
    state: options.state,
    viewModel: options.viewModel,
    parameterId,
    rigControlId,
    keyValue,
    angleDegrees
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  diagnostics.textContent = "";
  return {
    commandKind: "addRigControlAngleKeyform",
    parameterId,
    rigControlId,
    keyValue,
    angleDegrees
  };
};

const readDraftWarpLattice2dControlPointOffsetsKeyformCommand = (
  form: HTMLFormElement,
  diagnostics: HTMLElement,
  options: RigControlPanelOptions
): RigControlWarpLattice2dControlPointOffsetsKeyformDraftCommand | null => {
  const fields = new FormData(form);
  const parameterId = String(fields.get("parameterId") ?? "").trim();
  const target = parseWarpLatticeTarget(String(fields.get("warpTarget") ?? "").trim());
  const keyValue = toFiniteNumber(fields.get("keyValue"));
  const compositionMode = String(fields.get("compositionMode") ?? "").trim();
  const controlPointOffsets = readControlPointOffsets(fields);
  const validationMessage = validateDraftWarpLattice2dControlPointOffsetsKeyformInput({
    state: options.state,
    viewModel: options.viewModel,
    parameterId,
    target,
    keyValue,
    compositionMode,
    controlPointOffsets
  });

  if (validationMessage !== null) {
    diagnostics.textContent = validationMessage;
    return null;
  }

  if (
    target === null ||
    (compositionMode !== "replace" && compositionMode !== "additiveDelta") ||
    controlPointOffsets === null
  ) {
    return null;
  }

  diagnostics.textContent = "";
  return {
    commandKind: "draftWarpLattice2dControlPointOffsetsKeyform",
    target: {
      source: target.source,
      id: target.id,
      property: "controlPointOffsets"
    },
    parameterId,
    keyValue,
    compositionMode,
    controlPointOffsets
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

const validateDraftWarpLattice2dRigControlInput = (input: {
  readonly viewModel: EditorWorkflowViewModel;
  readonly draftRigControlId: string;
  readonly displayName: string;
  readonly partId: string;
  readonly domainBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}): string | null => {
  if (!input.viewModel.rigControls.canCreateWarpLattice2dDraft) {
    return input.viewModel.rigControls.warpLatticeCreateDraftDisabledMessage;
  }

  if (input.draftRigControlId.length === 0 || /\s/.test(input.draftRigControlId)) {
    return "Draft control ID is required and must not contain spaces.";
  }

  if (input.displayName.length === 0) {
    return "Control name is required.";
  }

  if (input.partId.length === 0) {
    return "Part is required.";
  }

  if (!input.viewModel.rigControls.partOptions.some((option) => option.partId === input.partId)) {
    return "Selected part is unavailable.";
  }

  if (
    !Number.isFinite(input.domainBounds.x) ||
    !Number.isFinite(input.domainBounds.y) ||
    !Number.isFinite(input.domainBounds.width) ||
    !Number.isFinite(input.domainBounds.height)
  ) {
    return "Domain bounds must contain finite values.";
  }

  if (input.domainBounds.width <= 0 || input.domainBounds.height <= 0) {
    return "Domain width and height must be positive.";
  }

  return null;
};

const validateAddRigControlAngleKeyformInput = (input: {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly parameterId: string;
  readonly rigControlId: string;
  readonly keyValue: number;
  readonly angleDegrees: number;
}): string | null => {
  const parameterOptions = input.viewModel.rigControls.angleKeyformParameterOptions;
  const rigControlOptions = input.viewModel.rigControls.angleKeyformRigControlOptions;

  if (parameterOptions.length === 0) {
    return "No authored input parameter available.";
  }

  if (rigControlOptions.length === 0) {
    return "No rotation2d rig control available.";
  }

  if (input.parameterId.length === 0 || input.rigControlId.length === 0) {
    return "Parameter and rotation2d rig control are required.";
  }

  if (!parameterOptions.some((option) => option.parameterId === input.parameterId)) {
    return "Selected parameter must be an authored input parameter.";
  }

  if (!rigControlOptions.some((option) => option.id === input.rigControlId)) {
    const rigControl = input.state.rigControls.find(
      (candidate) => candidate.rigControlId === input.rigControlId
    );
    return rigControl === undefined
      ? "Selected rotation2d rig control is unavailable."
      : "Selected rig control must be rotation2d with angleDegrees.";
  }

  if (!Number.isFinite(input.keyValue) || !Number.isFinite(input.angleDegrees)) {
    return "Key value and angle must contain finite values.";
  }

  return null;
};

const validateDraftWarpLattice2dBindChildInput = (input: {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly parent: RigControlWarpLattice2dBindChildDraftCommand["parent"] | null;
  readonly child: EditorWorkflowBindRigControlChildCommand["child"] | null;
}): string | null => {
  if (!input.viewModel.rigControls.canDraftWarpLattice2dBindChild) {
    return input.viewModel.rigControls.warpLatticeBindDraftDisabledMessage;
  }

  if (input.parent === null || input.child === null) {
    return "Warp parent and child are required.";
  }

  if (!isKnownWarpLatticeTarget(input.viewModel, input.parent)) {
    return "Selected warpLattice2d draft target is unavailable.";
  }

  if (!isKnownWarpLatticeChild(input.viewModel, input.child)) {
    return "Selected child target is unavailable for warpLattice2d draft binding.";
  }

  if (input.parent.source === "package" && input.child.kind === "rigControl" && input.child.id === input.parent.id) {
    return "Parent rig control cannot be bound to itself.";
  }

  if (
    input.child.kind === "rigControl" &&
    !input.state.rigControls.some((rigControl) => rigControl.rigControlId === input.child?.id)
  ) {
    return "Selected child rig control is unavailable.";
  }

  return null;
};

const validateDraftWarpLattice2dControlPointOffsetsKeyformInput = (input: {
  readonly state: EditorSemanticState;
  readonly viewModel: EditorWorkflowViewModel;
  readonly parameterId: string;
  readonly target: RigControlWarpLattice2dBindChildDraftCommand["parent"] | null;
  readonly keyValue: number;
  readonly compositionMode: string;
  readonly controlPointOffsets: readonly { readonly x: number; readonly y: number }[] | null;
}): string | null => {
  const parameterOptions = input.viewModel.rigControls.angleKeyformParameterOptions;

  if (!input.viewModel.rigControls.canCreateWarpLattice2dKeyformDraft) {
    return input.viewModel.rigControls.warpLatticeKeyformDraftDisabledMessage;
  }

  if (parameterOptions.length === 0) {
    return "No authored input parameter available.";
  }

  if (input.viewModel.rigControls.warpLatticeTargetOptions.length === 0) {
    return "No warpLattice2d draft target available.";
  }

  if (input.parameterId.length === 0 || input.target === null) {
    return "Parameter and warp lattice target are required.";
  }

  if (!parameterOptions.some((option) => option.parameterId === input.parameterId)) {
    return "Selected parameter must be an authored input parameter.";
  }

  if (!isKnownWarpLatticeTarget(input.viewModel, input.target)) {
    const rigControl = input.state.rigControls.find(
      (candidate) => candidate.rigControlId === input.target?.id
    );
    return rigControl === undefined
      ? "Selected warpLattice2d target is unavailable."
      : "Selected rig control must be warpLattice2d with controlPointOffsets.";
  }

  if (input.compositionMode !== "replace" && input.compositionMode !== "additiveDelta") {
    return "Patch mode must be replace or additiveDelta.";
  }

  if (!Number.isFinite(input.keyValue)) {
    return "Key value must contain a finite value.";
  }

  if (input.controlPointOffsets === null) {
    return "All 2x2 control point offsets must contain finite values.";
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

const parseWarpLatticeTarget = (
  value: string
): RigControlWarpLattice2dBindChildDraftCommand["parent"] | null => {
  const separatorIndex = value.indexOf(":");
  if (separatorIndex < 0) {
    return null;
  }

  const source = value.slice(0, separatorIndex);
  const id = value.slice(separatorIndex + 1);
  if ((source !== "draft" && source !== "package") || id.length === 0) {
    return null;
  }

  return { source, id };
};

const readControlPointOffsets = (
  fields: FormData
): readonly { readonly x: number; readonly y: number }[] | null => {
  const offsets = [0, 1, 2, 3].map((index) => ({
    x: toFiniteNumber(fields.get(`offsetX${index}`)),
    y: toFiniteNumber(fields.get(`offsetY${index}`))
  }));

  return offsets.every((offset) => Number.isFinite(offset.x) && Number.isFinite(offset.y))
    ? offsets
    : null;
};

const isKnownWarpLatticeTarget = (
  viewModel: EditorWorkflowViewModel,
  target: RigControlWarpLattice2dBindChildDraftCommand["parent"]
): boolean =>
  viewModel.rigControls.warpLatticeTargetOptions.some(
    (option) => option.source === target.source && option.id === target.id
  );

const isKnownWarpLatticeChild = (
  viewModel: EditorWorkflowViewModel,
  child: EditorWorkflowBindRigControlChildCommand["child"]
): boolean =>
  viewModel.rigControls.warpLatticeChildOptions.some(
    (option) => option.kind === child.kind && option.id === child.id
  );

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

const formatRigControlDraftKeyformEvidence = (
  state: EditorSemanticState,
  rigControl: EditorSemanticState["rigControls"][number]
): string => {
  if (rigControl.kind === "warpLattice2d") {
    return `controlPointOffsets draft keyforms ${formatRigControlWarpLatticeKeyformEvidence(state, rigControl.rigControlId)}`;
  }

  return `rest ${formatOptionalNumber(rigControl.restAngleDegrees)}; angle keyforms ${formatRigControlAngleKeyformEvidence(state, rigControl.rigControlId)}`;
};

const formatRigControlAngleKeyformEvidence = (
  state: EditorSemanticState,
  rigControlId: string
): string => {
  const keyforms = state.rigControlAngleKeyforms.filter(
    (keyform) => keyform.rigControlId === rigControlId
  );

  if (keyforms.length === 0) {
    return "None";
  }

  return keyforms
    .map((keyform) => `${keyform.parameterId}@${formatOptionalNumber(keyform.keyValue)} -> ${formatOptionalNumber(keyform.angleDegrees)} deg`)
    .join(", ");
};

const formatRigControlWarpLatticeKeyformEvidence = (
  state: EditorSemanticState,
  rigControlId: string
): string => {
  const keyforms = state.rigControlWarpLatticeKeyforms.filter(
    (keyform) => keyform.rigControlId === rigControlId
  );

  if (keyforms.length === 0) {
    return "None";
  }

  return keyforms
    .map(
      (keyform) =>
        `${keyform.parameterId}@${formatOptionalNumber(keyform.keyValue)} ${keyform.compositionMode} ${formatControlPointOffsets(keyform.controlPointOffsets)}`
    )
    .join(", ");
};

const formatControlPointOffsets = (
  offsets: readonly { readonly x: number; readonly y: number }[]
): string =>
  offsets
    .map((offset, index) => `p${index} ${formatOptionalNumber(offset.x)}, ${formatOptionalNumber(offset.y)}`)
    .join("; ");
