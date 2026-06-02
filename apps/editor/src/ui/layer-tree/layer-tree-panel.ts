import {
  createLayerTreeDrawablePartDraftFormTestId,
  createLayerTreeDrawablePartDraftSubmitTestId,
  createLayerTreeDrawableRowTestId,
  createLayerTreeDrawableTextureDraftFormTestId,
  createLayerTreeDrawableTextureDraftSubmitTestId,
  createLayerTreeEmptyLeafDeleteDraftTestId,
  createLayerTreePartReparentFormTestId,
  createLayerTreePartReparentSubmitTestId,
  createLayerTreePartGroupTestId,
  createLayerTreePartRenameFormTestId,
  createLayerTreePartRenameSubmitTestId,
  createLayerTreeSelectDrawableTestId,
  createLayerTreeToggleEditorHiddenTestId,
  createLayerTreeToggleLockTestId,
  editorTestIds,
  type LayerTreeDrawablePartAssignmentDraftCommand,
  type LayerTreeDrawableTextureAssignmentDraftCommand,
  type LayerTreeDrawableViewModel,
  type LayerTreeEmptyLeafPartDeleteDraftCommand,
  type LayerTreePartGroupViewModel,
  type LayerTreePartRenameDraftCommand,
  type LayerTreePartReparentDraftCommand,
  type LayerTreeViewModel,
  type PartTextureWorkflowViewModel
} from "../../editor-state/index.js";
import type {
  EditorCreatePartCommand,
  EditorSetDrawablePartCommand,
  EditorSetDrawableTextureCommand,
  EditorUpdatePartCommand
} from "../../editor-session/index.js";

export interface LayerTreePanelOptions {
  readonly viewModel: LayerTreeViewModel;
  readonly workflow: PartTextureWorkflowViewModel;
  readonly onCreatePart: (command: EditorCreatePartCommand) => void;
  readonly onUpdatePart: (command: EditorUpdatePartCommand) => void;
  readonly onSetDrawablePart: (command: EditorSetDrawablePartCommand) => void;
  readonly onSetDrawableTexture: (command: EditorSetDrawableTextureCommand) => void;
  readonly onSelectDrawable: (drawableId: string) => void;
  readonly onToggleDrawableLock: (drawableId: string) => void;
  readonly onToggleDrawableEditorHidden: (drawableId: string) => void;
  readonly onDraftPartRename?: (command: LayerTreePartRenameDraftCommand) => void;
  readonly onDraftPartReparent?: (command: LayerTreePartReparentDraftCommand) => void;
  readonly onDraftEmptyLeafPartDelete?: (command: LayerTreeEmptyLeafPartDeleteDraftCommand) => void;
  readonly onDraftDrawablePartAssignment?: (
    command: LayerTreeDrawablePartAssignmentDraftCommand
  ) => void;
  readonly onDraftDrawableTextureAssignment?: (
    command: LayerTreeDrawableTextureAssignmentDraftCommand
  ) => void;
  readonly onCommitDirectManipulationDrafts?: () => void;
  readonly onClearDirectManipulationDrafts?: () => void;
}

export const createLayerTreePanel = (options: LayerTreePanelOptions): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel layer-tree-panel";
  panel.dataset.testid = editorTestIds.layerTreePanel;
  panel.setAttribute("aria-labelledby", "editor-layer-tree-heading");

  const heading = document.createElement("h2");
  heading.id = "editor-layer-tree-heading";
  heading.textContent = "Layer Tree";

  panel.append(heading, createSummary(options.viewModel), createWorkflowControls(options));

  if (options.viewModel.partGroups.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "layer-tree-panel__empty";
    emptyState.textContent = "No parts or drawables yet.";
    panel.append(emptyState);

    return panel;
  }

  for (const partGroup of options.viewModel.partGroups) {
    panel.append(createPartGroup(partGroup, options));
  }

  return panel;
};

const createWorkflowControls = (options: LayerTreePanelOptions): HTMLElement => {
  const controls = document.createElement("div");
  controls.className = "layer-tree-panel__workflow";
  controls.setAttribute("style", responsiveStackStyle);
  controls.append(
    createCreatePartForm(options),
    createUpdatePartForm(options),
    createDrawablePartAssignmentForm(options),
    createDrawableTextureAssignmentForm(options),
    createDirectManipulationDraftControls(options)
  );

  return controls;
};

const responsiveStackStyle =
  "display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; min-width: 0; max-width: 100%;";
const responsiveFormStyle =
  "display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: 12px; min-width: 0; max-width: 100%; margin-top: 14px;";
const rowDraftControlsStyle =
  "display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: 8px; min-width: 0; max-width: 100%;";
const rowDraftFormStyle =
  "display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; min-width: 0; max-width: 100%;";
const wideFormItemStyle = "grid-column: 1 / -1; min-width: 0; max-width: 100%;";
const formHeadingStyle = `${wideFormItemStyle} margin: 0;`;
const wrappingTextStyle = "min-width: 0; max-width: 100%; overflow-wrap: anywhere;";
const constrainedControlStyle =
  "box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0;";

const applyResponsiveFormLayout = (form: HTMLFormElement): void => {
  form.setAttribute("style", responsiveFormStyle);
};

const applyWideFormItem = (element: HTMLElement): void => {
  element.setAttribute("style", wideFormItemStyle);
};

const applyFormHeadingLayout = (heading: HTMLElement): void => {
  heading.setAttribute("style", formHeadingStyle);
};

const createTextInput = (options: {
  readonly label: string;
  readonly value: string;
}): {
  readonly field: HTMLElement;
  readonly input: HTMLInputElement;
} => {
  const field = document.createElement("label");
  field.className = "editor-field layer-tree-panel__field";
  field.setAttribute("style", wrappingTextStyle);
  field.textContent = options.label;

  const input = document.createElement("input");
  input.type = "text";
  input.value = options.value;
  input.className = "layer-tree-panel__input";
  input.setAttribute("style", constrainedControlStyle);
  field.append(input);

  return { field, input };
};

const createSelect = (options: {
  readonly label: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
    readonly disabled?: boolean;
  }[];
  readonly value: string;
}): {
  readonly field: HTMLElement;
  readonly select: HTMLSelectElement;
} => {
  const field = document.createElement("label");
  field.className = "editor-field layer-tree-panel__field";
  field.setAttribute("style", wrappingTextStyle);
  field.textContent = options.label;

  const select = document.createElement("select");
  select.className = "layer-tree-panel__select";
  select.setAttribute("style", constrainedControlStyle);
  for (const option of options.options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    item.disabled = option.disabled ?? false;
    select.append(item);
  }
  select.value = options.value;
  const updateTitle = (): void => {
    select.setAttribute(
      "title",
      options.options.find((option) => option.value === select.value)?.label ?? options.label
    );
  };
  updateTitle();
  select.addEventListener("change", updateTitle);
  field.append(select);

  return { field, select };
};

const createSubmitButton = (options: {
  readonly text: string;
  readonly testId: string;
  readonly disabled: boolean;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "editor-button editor-button--primary layer-tree-panel__action";
  button.dataset.testid = options.testId;
  button.disabled = options.disabled;
  button.setAttribute("style", wideFormItemStyle);
  button.textContent = options.text;

  return button;
};

const createCreatePartForm = (options: LayerTreePanelOptions): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "layer-tree-panel__form";
  form.dataset.testid = editorTestIds.layerTreeCreatePartForm;
  applyResponsiveFormLayout(form);

  const heading = document.createElement("h3");
  heading.textContent = "Create Part";
  applyFormHeadingLayout(heading);

  const name = createTextInput({
    label: "Display name",
    value: options.workflow.defaultCreatePartName
  });
  const parent = createSelect({
    label: "Parent",
    options: [
      { value: "", label: "No parent" },
      ...options.workflow.partOptions.map((part) => ({ value: part.partId, label: part.label }))
    ],
    value: options.workflow.defaultParentPartId
  });
  const submit = createSubmitButton({
    text: "Create part",
    testId: editorTestIds.layerTreeCreatePartSubmit,
    disabled: !options.workflow.canCreatePart
  });

  form.append(heading, name.field, parent.field, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const displayName = name.input.value.trim();
    if (displayName.length === 0 || !options.workflow.canCreatePart) {
      return;
    }

    options.onCreatePart({
      displayName,
      ...(parent.select.value.length === 0 ? {} : { parentPartId: parent.select.value })
    });
  });

  return form;
};

const createUpdatePartForm = (options: LayerTreePanelOptions): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "layer-tree-panel__form";
  form.dataset.testid = editorTestIds.layerTreeUpdatePartForm;
  applyResponsiveFormLayout(form);

  const heading = document.createElement("h3");
  heading.textContent = "Update Part";
  applyFormHeadingLayout(heading);

  const part = createSelect({
    label: "Part",
    options: options.workflow.partOptions.map((candidate) => ({
      value: candidate.partId,
      label: candidate.label
    })),
    value: options.workflow.defaultUpdatePartId
  });
  const name = createTextInput({
    label: "Display name",
    value: options.workflow.defaultUpdatePartName
  });
  const submit = createSubmitButton({
    text: "Update part",
    testId: editorTestIds.layerTreeUpdatePartSubmit,
    disabled: !options.workflow.canUpdatePart
  });

  form.append(heading, part.field, name.field, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const displayName = name.input.value.trim();
    if (
      part.select.value.length === 0 ||
      displayName.length === 0 ||
      !options.workflow.canUpdatePart
    ) {
      return;
    }

    options.onUpdatePart({
      partId: part.select.value,
      displayName
    });
  });

  return form;
};

const createDrawablePartAssignmentForm = (options: LayerTreePanelOptions): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "layer-tree-panel__form";
  form.dataset.testid = editorTestIds.layerTreeAssignPartForm;
  applyResponsiveFormLayout(form);

  const heading = document.createElement("h3");
  heading.textContent = "Drawable Part";
  applyFormHeadingLayout(heading);

  const drawable = createSelect({
    label: "Drawable",
    options: options.workflow.drawableOptions.map((candidate) => ({
      value: candidate.drawableId,
      label: candidate.label
    })),
    value: options.workflow.defaultDrawableId
  });
  const part = createSelect({
    label: "Part",
    options: options.workflow.partOptions.map((candidate) => ({
      value: candidate.partId,
      label: candidate.label
    })),
    value: options.workflow.defaultTargetPartId
  });
  const status = document.createElement("p");
  status.className = "editor-panel__meta";
  applyWideFormItem(status);
  status.textContent = options.workflow.partAssignmentStatusLabel;
  const submit = createSubmitButton({
    text: "Move drawable",
    testId: editorTestIds.layerTreeAssignPartSubmit,
    disabled: !options.workflow.canAssignDrawablePart
  });

  form.append(heading, status, drawable.field, part.field, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      drawable.select.value.length === 0 ||
      part.select.value.length === 0 ||
      !options.workflow.canAssignDrawablePart
    ) {
      return;
    }

    options.onSetDrawablePart({
      drawableId: drawable.select.value,
      partId: part.select.value
    });
  });

  return form;
};

const createDrawableTextureAssignmentForm = (options: LayerTreePanelOptions): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "layer-tree-panel__form";
  form.dataset.testid = editorTestIds.layerTreeAssignTextureForm;
  applyResponsiveFormLayout(form);

  const heading = document.createElement("h3");
  heading.textContent = "Drawable Texture";
  applyFormHeadingLayout(heading);

  const drawable = createSelect({
    label: "Drawable",
    options: options.workflow.drawableOptions.map((candidate) => ({
      value: candidate.drawableId,
      label: candidate.label
    })),
    value: options.workflow.defaultDrawableId
  });
  const texture = createSelect({
    label: "Texture",
    options: options.workflow.textureOptions.map((candidate) => ({
      value: candidate.textureId,
      label: candidate.label
    })),
    value: options.workflow.defaultTextureId
  });
  const status = document.createElement("p");
  status.className = "editor-panel__meta";
  applyWideFormItem(status);
  status.textContent = options.workflow.textureAssignmentStatusLabel;
  const submit = createSubmitButton({
    text: "Assign texture",
    testId: editorTestIds.layerTreeAssignTextureSubmit,
    disabled: !options.workflow.canAssignDrawableTexture
  });

  form.append(heading, status, drawable.field, texture.field, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      drawable.select.value.length === 0 ||
      texture.select.value.length === 0 ||
      !options.workflow.canAssignDrawableTexture
    ) {
      return;
    }

    options.onSetDrawableTexture({
      drawableId: drawable.select.value,
      textureId: texture.select.value
    });
  });

  return form;
};

const createDirectManipulationDraftControls = (options: LayerTreePanelOptions): HTMLElement => {
  const controls = document.createElement("div");
  controls.className = "layer-tree-panel__form";
  controls.setAttribute("style", responsiveFormStyle);

  const heading = document.createElement("h3");
  heading.textContent = "Direct Drafts";
  applyFormHeadingLayout(heading);

  const status = document.createElement("p");
  status.className = "editor-panel__meta";
  applyWideFormItem(status);
  status.textContent = options.viewModel.directManipulationSummaryLabel;

  const commit = createActionButton({
    text: "Commit direct drafts",
    label: "Commit layer tree direct manipulation drafts",
    pressed: false,
    disabled:
      options.viewModel.directManipulationDraftCount === 0 ||
      options.onCommitDirectManipulationDrafts === undefined,
    testId: editorTestIds.layerTreeDirectDraftCommit,
    onClick: () => {
      if (
        options.viewModel.directManipulationDraftCount === 0 ||
        options.onCommitDirectManipulationDrafts === undefined
      ) {
        return;
      }

      options.onCommitDirectManipulationDrafts();
    }
  });
  commit.setAttribute("style", wideFormItemStyle);

  const clear = createActionButton({
    text: "Clear direct drafts",
    label: "Clear layer tree direct manipulation drafts",
    pressed: false,
    disabled:
      options.viewModel.directManipulationDraftCount === 0 ||
      options.onClearDirectManipulationDrafts === undefined,
    testId: editorTestIds.layerTreeDirectDraftClear,
    onClick: () => {
      if (
        options.viewModel.directManipulationDraftCount === 0 ||
        options.onClearDirectManipulationDrafts === undefined
      ) {
        return;
      }

      options.onClearDirectManipulationDrafts();
    }
  });
  clear.setAttribute("style", wideFormItemStyle);

  controls.append(heading, status, commit, clear);

  return controls;
};

const createSummary = (viewModel: LayerTreeViewModel): HTMLElement => {
  const summary = document.createElement("p");
  summary.className = "layer-tree-panel__summary";
  summary.dataset.testid = editorTestIds.layerTreeSummary;
  summary.setAttribute("role", "status");
  summary.setAttribute("style", wrappingTextStyle);
  summary.textContent = viewModel.summaryLabel;

  return summary;
};

const createPartGroup = (
  partGroup: LayerTreePartGroupViewModel,
  options: LayerTreePanelOptions
): HTMLElement => {
  const group = document.createElement("section");
  group.className = `layer-tree-panel__part layer-tree-panel__part--${partGroup.partStatus}`;
  group.dataset.testid = createLayerTreePartGroupTestId(partGroup.partId);
  group.dataset.depth = `${partGroup.depth}`;
  group.setAttribute("style", wrappingTextStyle);
  group.setAttribute("aria-label", partGroup.partLabel);

  const heading = document.createElement("h3");
  heading.setAttribute("style", wrappingTextStyle);
  heading.textContent = partGroup.partLabel;

  const count = document.createElement("p");
  count.className = "layer-tree-panel__part-count";
  count.setAttribute("style", wrappingTextStyle);
  count.textContent = partGroup.drawableCountLabel;

  group.append(heading, count);
  group.append(createPartDirectManipulationControls(partGroup, options));

  if (partGroup.drawables.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "layer-tree-panel__empty-part";
    emptyState.textContent = "No drawables in this part.";
    group.append(emptyState);

    return group;
  }

  const list = document.createElement("ul");
  list.className = "layer-tree-panel__drawable-list";
  list.setAttribute("style", "min-width: 0; max-width: 100%;");
  for (const drawable of partGroup.drawables) {
    list.append(createDrawableRow(drawable, options));
  }
  group.append(list);

  return group;
};

const createPartDirectManipulationControls = (
  partGroup: LayerTreePartGroupViewModel,
  options: LayerTreePanelOptions
): HTMLElement => {
  const controls = document.createElement("div");
  controls.className = "layer-tree-panel__part-direct-controls";
  controls.setAttribute("style", rowDraftControlsStyle);
  controls.append(
    createPartRenameDraftForm(partGroup, options),
    createPartReparentDraftForm(partGroup, options),
    createEmptyLeafDeleteDraftControl(partGroup, options)
  );

  return controls;
};

const createPartRenameDraftForm = (
  partGroup: LayerTreePartGroupViewModel,
  options: LayerTreePanelOptions
): HTMLFormElement => {
  const draft = partGroup.directManipulation;
  const form = document.createElement("form");
  form.className = "layer-tree-panel__row-form";
  form.dataset.testid = createLayerTreePartRenameFormTestId(partGroup.partId);
  form.setAttribute("style", rowDraftFormStyle);

  const name = createTextInput({
    label: "Part name",
    value: draft.renameValue
  });
  const status = createRowMeta(draft.renameDisabledMessage ?? draft.statusLabel);
  const submit = createSubmitButton({
    text: draft.renameDrafted ? "Update rename draft" : "Draft rename",
    testId: createLayerTreePartRenameSubmitTestId(partGroup.partId),
    disabled: !draft.canDraftRename || options.onDraftPartRename === undefined
  });

  form.append(name.field, status, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const displayName = name.input.value.trim();
    if (
      displayName.length === 0 ||
      (!draft.renameDrafted && displayName === draft.currentDisplayName) ||
      !draft.canDraftRename ||
      options.onDraftPartRename === undefined
    ) {
      return;
    }

    options.onDraftPartRename({
      partId: partGroup.partId,
      displayName
    });
  });

  return form;
};

const createPartReparentDraftForm = (
  partGroup: LayerTreePartGroupViewModel,
  options: LayerTreePanelOptions
): HTMLFormElement => {
  const draft = partGroup.directManipulation;
  const form = document.createElement("form");
  form.className = "layer-tree-panel__row-form";
  form.dataset.testid = createLayerTreePartReparentFormTestId(partGroup.partId);
  form.setAttribute("style", rowDraftFormStyle);

  const parent = createSelect({
    label: "Parent",
    options: draft.parentOptions.map((option) => ({
      value: option.value,
      label: option.label,
      disabled: option.disabled
    })),
    value: draft.parentOptionValue
  });
  const status = createRowMeta(draft.reparentDisabledMessage ?? draft.statusLabel);
  const submit = createSubmitButton({
    text: draft.reparentDrafted ? "Update parent draft" : "Draft parent",
    testId: createLayerTreePartReparentSubmitTestId(partGroup.partId),
    disabled: !draft.canDraftReparent || options.onDraftPartReparent === undefined
  });

  form.append(parent.field, status, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const parentPartId = parent.select.value.length === 0 ? null : parent.select.value;
    if (
      (!draft.reparentDrafted && parentPartId === draft.currentParentPartId) ||
      !draft.canDraftReparent ||
      isSelectedOptionDisabled(parent.select, draft.parentOptions) ||
      options.onDraftPartReparent === undefined
    ) {
      return;
    }

    options.onDraftPartReparent({
      partId: partGroup.partId,
      parentPartId
    });
  });

  return form;
};

const createEmptyLeafDeleteDraftControl = (
  partGroup: LayerTreePartGroupViewModel,
  options: LayerTreePanelOptions
): HTMLElement => {
  const draft = partGroup.directManipulation;
  const control = document.createElement("div");
  control.className = "layer-tree-panel__row-form";
  control.setAttribute("style", rowDraftFormStyle);

  const status = createRowMeta(draft.emptyLeafDeleteDisabledMessage ?? draft.statusLabel);
  const button = createActionButton({
    text: draft.emptyLeafDeleteDrafted ? "Delete draft pending" : "Draft empty-leaf delete",
    label: `Draft empty-leaf delete for ${partGroup.displayName}`,
    pressed: draft.emptyLeafDeleteDrafted,
    disabled:
      !draft.canDraftEmptyLeafDelete || options.onDraftEmptyLeafPartDelete === undefined,
    testId: createLayerTreeEmptyLeafDeleteDraftTestId(partGroup.partId),
    onClick: () => {
      if (!draft.canDraftEmptyLeafDelete || options.onDraftEmptyLeafPartDelete === undefined) {
        return;
      }

      options.onDraftEmptyLeafPartDelete({ partId: partGroup.partId });
    }
  });

  control.append(status, button);

  return control;
};

const createDrawableRow = (
  drawable: LayerTreeDrawableViewModel,
  options: LayerTreePanelOptions
): HTMLLIElement => {
  const row = document.createElement("li");
  row.className = "layer-tree-panel__drawable";
  row.dataset.testid = createLayerTreeDrawableRowTestId(drawable.drawableId);
  row.setAttribute("style", "display: grid; gap: 6px; min-width: 0; max-width: 100%;");

  const title = document.createElement("span");
  title.className = "layer-tree-panel__drawable-title";
  title.setAttribute("style", wrappingTextStyle);
  title.textContent = `${drawable.displayName} / ${drawable.drawableId}`;

  const state = document.createElement("span");
  state.className = "layer-tree-panel__drawable-state";
  state.setAttribute("style", wrappingTextStyle);
  state.textContent = drawable.stateLabel;

  const texture = document.createElement("span");
  texture.className = `layer-tree-panel__texture layer-tree-panel__texture--${drawable.textureStatus}`;
  texture.setAttribute("style", wrappingTextStyle);
  texture.textContent = drawable.textureLabel;

  const directControls = createDrawableDirectManipulationControls(drawable, options);

  const actions = document.createElement("span");
  actions.className = "layer-tree-panel__actions";
  actions.setAttribute("style", "display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; max-width: 100%;");
  actions.append(
    createActionButton({
      text: drawable.selected ? "Selected" : "Select",
      label: `Select ${drawable.displayName}`,
      pressed: drawable.selected,
      testId: createLayerTreeSelectDrawableTestId(drawable.drawableId),
      onClick: () => options.onSelectDrawable(drawable.drawableId)
    }),
    createActionButton({
      text: drawable.locked ? "Unlock" : "Lock",
      label: drawable.locked ? `Unlock ${drawable.displayName}` : `Lock ${drawable.displayName}`,
      pressed: drawable.locked,
      testId: createLayerTreeToggleLockTestId(drawable.drawableId),
      onClick: () => options.onToggleDrawableLock(drawable.drawableId)
    }),
    createActionButton({
      text: drawable.editorHidden ? "Show in editor" : "Hide in editor",
      label: drawable.editorHidden
        ? `Show ${drawable.displayName} in editor`
        : `Hide ${drawable.displayName} in editor`,
      pressed: drawable.editorHidden,
      testId: createLayerTreeToggleEditorHiddenTestId(drawable.drawableId),
      onClick: () => options.onToggleDrawableEditorHidden(drawable.drawableId)
    })
  );

  row.append(title, state, texture, directControls, actions);

  return row;
};

const createDrawableDirectManipulationControls = (
  drawable: LayerTreeDrawableViewModel,
  options: LayerTreePanelOptions
): HTMLElement => {
  const controls = document.createElement("div");
  controls.className = "layer-tree-panel__drawable-direct-controls";
  controls.setAttribute("style", rowDraftControlsStyle);
  controls.append(
    createDrawablePartDraftForm(drawable, options),
    createDrawableTextureDraftForm(drawable, options)
  );

  return controls;
};

const createDrawablePartDraftForm = (
  drawable: LayerTreeDrawableViewModel,
  options: LayerTreePanelOptions
): HTMLFormElement => {
  const draft = drawable.directManipulation;
  const form = document.createElement("form");
  form.className = "layer-tree-panel__row-form";
  form.dataset.testid = createLayerTreeDrawablePartDraftFormTestId(drawable.drawableId);
  form.setAttribute("style", rowDraftFormStyle);

  const part = createSelect({
    label: "Part",
    options: draft.partOptions.map((option) => ({
      value: option.value,
      label: option.label,
      disabled: option.disabled
    })),
    value: draft.partOptionValue
  });
  const status = createRowMeta(draft.partAssignmentDisabledMessage ?? draft.statusLabel);
  const submit = createSubmitButton({
    text: draft.partAssignmentDrafted ? "Update part draft" : "Draft part",
    testId: createLayerTreeDrawablePartDraftSubmitTestId(drawable.drawableId),
    disabled:
      !draft.canDraftPartAssignment || options.onDraftDrawablePartAssignment === undefined
  });

  form.append(part.field, status, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      part.select.value.length === 0 ||
      (!draft.partAssignmentDrafted && part.select.value === draft.currentPartId) ||
      !draft.canDraftPartAssignment ||
      isSelectedOptionDisabled(part.select, draft.partOptions) ||
      options.onDraftDrawablePartAssignment === undefined
    ) {
      return;
    }

    options.onDraftDrawablePartAssignment({
      drawableId: drawable.drawableId,
      partId: part.select.value
    });
  });

  return form;
};

const createDrawableTextureDraftForm = (
  drawable: LayerTreeDrawableViewModel,
  options: LayerTreePanelOptions
): HTMLFormElement => {
  const draft = drawable.directManipulation;
  const form = document.createElement("form");
  form.className = "layer-tree-panel__row-form";
  form.dataset.testid = createLayerTreeDrawableTextureDraftFormTestId(drawable.drawableId);
  form.setAttribute("style", rowDraftFormStyle);

  const texture = createSelect({
    label: "Texture",
    options: draft.textureOptions.map((option) => ({
      value: option.value,
      label: option.label,
      disabled: option.disabled
    })),
    value: draft.textureOptionValue
  });
  const status = createRowMeta(draft.textureAssignmentDisabledMessage ?? draft.statusLabel);
  const submit = createSubmitButton({
    text: draft.textureAssignmentDrafted ? "Update texture draft" : "Draft texture",
    testId: createLayerTreeDrawableTextureDraftSubmitTestId(drawable.drawableId),
    disabled:
      !draft.canDraftTextureAssignment ||
      options.onDraftDrawableTextureAssignment === undefined
  });

  form.append(texture.field, status, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      texture.select.value.length === 0 ||
      (!draft.textureAssignmentDrafted && texture.select.value === draft.currentTextureId) ||
      !draft.canDraftTextureAssignment ||
      isSelectedOptionDisabled(texture.select, draft.textureOptions) ||
      options.onDraftDrawableTextureAssignment === undefined
    ) {
      return;
    }

    options.onDraftDrawableTextureAssignment({
      drawableId: drawable.drawableId,
      textureId: texture.select.value
    });
  });

  return form;
};

const createActionButton = (options: {
  readonly text: string;
  readonly label: string;
  readonly pressed: boolean;
  readonly disabled?: boolean;
  readonly testId: string;
  readonly onClick: () => void;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "drawable-list__control layer-tree-panel__action";
  button.dataset.testid = options.testId;
  button.disabled = options.disabled ?? false;
  button.setAttribute("aria-label", options.label);
  button.setAttribute("aria-pressed", options.pressed ? "true" : "false");
  button.setAttribute("style", "max-width: 100%; white-space: normal;");
  button.textContent = options.text;
  button.addEventListener("click", options.onClick);

  return button;
};

const createRowMeta = (text: string): HTMLElement => {
  const status = document.createElement("p");
  status.className = "editor-panel__meta layer-tree-panel__row-meta";
  status.setAttribute("style", wrappingTextStyle);
  status.textContent = text;

  return status;
};

const isSelectedOptionDisabled = (
  select: HTMLSelectElement,
  options: readonly { readonly value: string; readonly disabled: boolean }[]
): boolean => options.find((option) => option.value === select.value)?.disabled ?? false;
