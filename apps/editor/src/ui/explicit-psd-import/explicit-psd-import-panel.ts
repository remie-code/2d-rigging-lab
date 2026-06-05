import {
  editorTestIds,
  type ExplicitPsdImportViewModel
} from "../../editor-state/index.js";
import type {
  EditorExplicitPsdImportFileCommand,
  EditorExplicitPsdLayerIntakeCommand
} from "../../editor-workflow/index.js";

export interface ExplicitPsdImportPanelOptions {
  readonly viewModel: ExplicitPsdImportViewModel;
  readonly destinationParts: readonly {
    readonly partId: string;
    readonly label: string;
  }[];
  readonly onParsePsdFile: (
    command: EditorExplicitPsdImportFileCommand
  ) => unknown | Promise<unknown>;
  readonly onIntakeSelectedLayer: (
    command: EditorExplicitPsdLayerIntakeCommand
  ) => unknown | Promise<unknown>;
}

export const createExplicitPsdImportPanel = (
  options: ExplicitPsdImportPanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel explicit-psd-import-panel";
  panel.dataset.testid = editorTestIds.explicitPsdImportPanel;
  panel.setAttribute("aria-labelledby", "editor-explicit-psd-import-heading");

  const heading = document.createElement("h2");
  heading.id = "editor-explicit-psd-import-heading";
  heading.textContent = "PSD Import";

  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.metaLabel;
  const parseForm = createExplicitPsdImportForm(options);

  panel.append(
    heading,
    meta,
    parseForm.form,
    createFactSection("Parser Session", editorTestIds.explicitPsdImportStatus, [
      { label: "Status", value: options.viewModel.statusLabel },
      { label: "Selected layer", value: options.viewModel.selectedLayerNodeRef }
    ]),
    createFactSection("Source File", editorTestIds.explicitPsdImportSource, options.viewModel.sourceFacts),
    createFactSection("Document", editorTestIds.explicitPsdImportDocument, options.viewModel.documentFacts),
    createFactSection(
      "Unsupported / Not Evaluated",
      editorTestIds.explicitPsdImportFeatureSupport,
      options.viewModel.featureFacts,
      [
        createTextList("Unsupported feature evidence", options.viewModel.unsupportedFeatureLabels),
        createTextList("Not evaluated feature evidence", options.viewModel.notEvaluatedFeatureLabels)
      ]
    ),
    createTextList(
      "Selected Layer Materialization",
      options.viewModel.materializationLabels,
      editorTestIds.explicitPsdImportMaterialization
    ),
    createLayerIntakeForm(options, parseForm.selectedLayerInput),
    createFactSection(
      "Selected Layer Intake Result",
      editorTestIds.explicitPsdImportLayerIntakeResult,
      [
        { label: "Status", value: options.viewModel.intakeStatusLabel },
        ...options.viewModel.intakeFacts
      ]
    ),
    createTextList(
      "Selected Layer Intake Diagnostics",
      options.viewModel.intakeDiagnostics,
      editorTestIds.explicitPsdImportLayerIntakeDiagnostics
    ),
    createLayerTree(options.viewModel, parseForm.selectedLayerInput),
    createFactSection(
      "Persistence Boundary",
      editorTestIds.explicitPsdImportPersistence,
      options.viewModel.persistenceFacts
    ),
    createTextList(
      "Diagnostics",
      options.viewModel.diagnostics,
      editorTestIds.explicitPsdImportDiagnostics
    )
  );

  return panel;
};

const createExplicitPsdImportForm = (
  options: ExplicitPsdImportPanelOptions
): {
  readonly form: HTMLFormElement;
  readonly selectedLayerInput: HTMLInputElement;
} => {
  const form = document.createElement("form");
  form.className = "explicit-psd-import-form";
  form.dataset.testid = editorTestIds.explicitPsdImportForm;
  form.setAttribute("aria-label", "Parse explicitly selected PSD in browser session");

  const fileLabel = document.createElement("label");
  fileLabel.className = "editor-field editor-field--wide";
  fileLabel.textContent = "PSD file";

  const fileInput = document.createElement("input");
  fileInput.name = "explicitPsdFile";
  fileInput.type = "file";
  fileInput.accept = ".psd,image/vnd.adobe.photoshop,application/octet-stream";
  fileInput.dataset.testid = editorTestIds.explicitPsdImportFileInput;
  fileLabel.append(fileInput);

  const selectedLayerLabel = document.createElement("label");
  selectedLayerLabel.className = "editor-field editor-field--wide";
  selectedLayerLabel.textContent = "Selected layer node ref";

  const selectedLayer = document.createElement("input");
  selectedLayer.name = "selectedLayerNodeRef";
  selectedLayer.type = "text";
  selectedLayer.value = options.viewModel.selectedLayerNodeRef;
  selectedLayer.autocomplete = "off";
  selectedLayer.dataset.testid = editorTestIds.explicitPsdImportSelectedLayerNodeRef;
  selectedLayerLabel.append(selectedLayer);

  const diagnostics = document.createElement("div");
  diagnostics.className = "explicit-psd-import-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.explicitPsdImportSubmit;
  submit.textContent = "Parse PSD";

  form.append(fileLabel, selectedLayerLabel, diagnostics, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = readFirstSelectedFile(fileInput);
    if (file === undefined) {
      diagnostics.replaceChildren(createDiagnosticLine("Select a PSD file before parsing."));
      return;
    }

    diagnostics.replaceChildren();
    try {
      await options.onParsePsdFile({
        file,
        selectedLayerNodeRef: selectedLayer.value.trim()
      });
    } catch (error) {
      diagnostics.replaceChildren(createDiagnosticLine(formatParseError(error)));
    }
  });

  return { form, selectedLayerInput: selectedLayer };
};

const createLayerIntakeForm = (
  options: ExplicitPsdImportPanelOptions,
  selectedLayerInput: HTMLInputElement
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "explicit-psd-import-form";
  form.dataset.testid = editorTestIds.explicitPsdImportLayerIntakeForm;
  form.setAttribute("aria-label", "Add explicitly selected PSD layer to project");

  const destinationKind = createSelectField({
    label: "Destination",
    name: "destinationKind",
    options: [
      {
        value: "existingPart",
        label: options.destinationParts.length === 0 ? "Existing part unavailable" : "Existing part",
        disabled: options.destinationParts.length === 0
      },
      { value: "newPart", label: "New part" }
    ],
    value: options.destinationParts.length === 0 ? "newPart" : "existingPart"
  });
  const existingPart = createSelectField({
    label: "Existing part",
    name: "destinationExistingPartId",
    options: options.destinationParts.length === 0
      ? [{ value: "", label: "No existing parts", disabled: true }]
      : options.destinationParts.map((part) => ({ value: part.partId, label: part.label })),
    value: options.destinationParts[0]?.partId ?? ""
  });
  const newPartName = createTextField({
    label: "New part name",
    name: "destinationNewPartName",
    value: "PSD Layer Part"
  });
  const parentPart = createSelectField({
    label: "New part parent",
    name: "destinationParentPartId",
    options: [
      { value: "", label: "No parent" },
      ...options.destinationParts.map((part) => ({ value: part.partId, label: part.label }))
    ],
    value: options.destinationParts[0]?.partId ?? ""
  });
  const drawableName = createTextField({
    label: "Drawable name",
    name: "drawableDisplayName",
    value: selectedLayerLabelFromViewModel(options.viewModel)
  });

  const diagnostics = document.createElement("div");
  diagnostics.className = "explicit-psd-import-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.explicitPsdImportLayerIntakeSubmit;
  submit.disabled = options.viewModel.status !== "parsed";
  submit.textContent = "Add selected layer";

  form.append(
    destinationKind.field,
    existingPart.field,
    newPartName.field,
    parentPart.field,
    drawableName.field,
    diagnostics,
    submit
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    diagnostics.replaceChildren();

    const selectedLayerNodeRef = selectedLayerInput.value.trim();
    const command = createLayerIntakeCommand({
      selectedLayerNodeRef,
      destinationKind: destinationKind.select.value,
      existingPartId: existingPart.select.value,
      newPartName: newPartName.input.value,
      parentPartId: parentPart.select.value,
      drawableDisplayName: drawableName.input.value
    });
    if (command.status === "invalid") {
      diagnostics.replaceChildren(createDiagnosticLine(command.message));
      return;
    }

    try {
      await options.onIntakeSelectedLayer(command.command);
    } catch (error) {
      diagnostics.replaceChildren(createDiagnosticLine(formatIntakeError(error)));
    }
  });

  return form;
};

const createLayerIntakeCommand = (input: {
  readonly selectedLayerNodeRef: string;
  readonly destinationKind: string;
  readonly existingPartId: string;
  readonly newPartName: string;
  readonly parentPartId: string;
  readonly drawableDisplayName: string;
}):
  | { readonly status: "valid"; readonly command: EditorExplicitPsdLayerIntakeCommand }
  | { readonly status: "invalid"; readonly message: string } => {
  if (input.selectedLayerNodeRef.length === 0) {
    return {
      status: "invalid",
      message: "Select one parsed PSD layer before adding it to the project."
    };
  }

  const drawableDisplayName = input.drawableDisplayName.trim();
  if (input.destinationKind === "newPart") {
    const displayName = input.newPartName.trim();
    if (displayName.length === 0) {
      return {
        status: "invalid",
        message: "New part name is required."
      };
    }

    return {
      status: "valid",
      command: {
        selectedLayerNodeRef: input.selectedLayerNodeRef,
        destinationPart: {
          destinationKind: "newPart",
          displayName,
          ...(input.parentPartId.trim().length === 0
            ? {}
            : { parentPartId: input.parentPartId.trim() })
        },
        ...(drawableDisplayName.length === 0 ? {} : { drawableDisplayName })
      }
    };
  }

  if (input.existingPartId.trim().length === 0) {
    return {
      status: "invalid",
      message: "Existing destination part is required."
    };
  }

  return {
    status: "valid",
    command: {
      selectedLayerNodeRef: input.selectedLayerNodeRef,
      destinationPart: {
        destinationKind: "existingPart",
        partId: input.existingPartId.trim()
      },
      ...(drawableDisplayName.length === 0 ? {} : { drawableDisplayName })
    }
  };
};

const readFirstSelectedFile = (input: HTMLInputElement): File | undefined => {
  const files = input.files;
  if (files === null || files.length === 0) {
    return undefined;
  }

  return files.item(0) ?? files[0] ?? undefined;
};

const createTextField = (options: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
}): {
  readonly field: HTMLElement;
  readonly input: HTMLInputElement;
} => {
  const field = document.createElement("label");
  field.className = "editor-field editor-field--wide";
  field.textContent = options.label;

  const input = document.createElement("input");
  input.name = options.name;
  input.type = "text";
  input.value = options.value;
  input.autocomplete = "off";
  input.style.width = "100%";
  input.style.boxSizing = "border-box";
  field.append(input);

  return { field, input };
};

const createSelectField = (options: {
  readonly label: string;
  readonly name: string;
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
  field.className = "editor-field editor-field--wide";
  field.textContent = options.label;

  const select = document.createElement("select");
  select.name = options.name;
  select.value = options.value;
  select.style.width = "100%";
  select.style.boxSizing = "border-box";
  for (const option of options.options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    item.disabled = option.disabled ?? false;
    select.append(item);
  }
  select.value = options.value;
  field.append(select);

  return { field, select };
};

const selectedLayerLabelFromViewModel = (
  viewModel: ExplicitPsdImportViewModel
): string => {
  const row = viewModel.treeRows.find((candidate) =>
    candidate.nodeRef === viewModel.selectedLayerNodeRef
  );
  if (row === undefined || row.kind !== "layer") {
    return "Selected PSD Layer";
  }

  return row.label.replace(/^layer:\s*/i, "").split(" / ")[0]?.trim() || "Selected PSD Layer";
};

const createFactSection = (
  headingText: string,
  testId: string,
  facts: readonly {
    readonly label: string;
    readonly value: string;
  }[],
  extraNodes: readonly HTMLElement[] = []
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-section";
  section.dataset.testid = testId;
  section.setAttribute("aria-label", headingText);

  const heading = document.createElement("h3");
  heading.textContent = headingText;

  const list = document.createElement("dl");
  list.className = "source-intake-summary";
  for (const fact of facts) {
    appendFact(list, fact.label, fact.value);
  }

  section.append(heading, list, ...extraNodes);
  return section;
};

const createLayerTree = (
  viewModel: ExplicitPsdImportViewModel,
  selectedLayerInput: HTMLInputElement
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-section";
  section.dataset.testid = editorTestIds.explicitPsdImportLayerTree;
  section.setAttribute("aria-label", "Parsed PSD layer tree");

  const heading = document.createElement("h3");
  heading.textContent = "Layer Tree";
  section.append(heading);

  if (viewModel.treeRows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "explicit-psd-import-empty";
    empty.textContent = "No parsed PSD layer tree";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ol");
  list.className = "explicit-psd-import-tree";
  for (const row of viewModel.treeRows) {
    const item = document.createElement("li");
    item.className = "explicit-psd-import-tree__row";
    item.style.paddingLeft = `${Math.max(0, row.depth - 1) * 14}px`;

    const choice = document.createElement("input");
    choice.type = "radio";
    choice.name = "explicitPsdLayerSelection";
    choice.value = row.nodeRef;
    choice.checked = row.nodeRef === viewModel.selectedLayerNodeRef;
    choice.disabled = row.kind !== "layer";
    choice.addEventListener("change", () => {
      if (!choice.disabled && choice.checked) {
        selectedLayerInput.value = choice.value;
      }
    });

    const label = document.createElement("span");
    label.className = "explicit-psd-import-tree__label";
    label.textContent = row.label;

    const meta = document.createElement("span");
    meta.className = "explicit-psd-import-tree__meta";
    meta.textContent = row.metaLabel;

    item.append(choice, label, meta);
    list.append(item);
  }

  section.append(list);
  return section;
};

const createTextList = (
  headingText: string,
  items: readonly string[],
  testId?: string
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-section";
  if (testId !== undefined) {
    section.dataset.testid = testId;
  }
  section.setAttribute("aria-label", headingText);

  const heading = document.createElement("h3");
  heading.textContent = headingText;

  const list = document.createElement("ul");
  list.className = "explicit-psd-import-list";
  for (const itemText of items) {
    const item = document.createElement("li");
    item.textContent = itemText;
    item.style.overflowWrap = "anywhere";
    list.append(item);
  }

  section.append(heading, list);
  return section;
};

const appendFact = (
  list: HTMLDListElement,
  label: string,
  value: string
): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;
  description.style.overflowWrap = "anywhere";

  list.append(term, description);
};

const createDiagnosticLine = (message: string): HTMLElement => {
  const line = document.createElement("p");
  line.textContent = message;
  line.style.overflowWrap = "anywhere";

  return line;
};

const formatParseError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Explicit PSD parse failed before workflow state update: ${message}`;
};

const formatIntakeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Explicit PSD layer intake failed before workflow state update: ${message}`;
};
