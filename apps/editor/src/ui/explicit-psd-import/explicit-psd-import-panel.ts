import {
  editorTestIds,
  type ExplicitPsdImportViewModel
} from "../../editor-state/index.js";
import type {
  EditorExplicitPsdImportFileCommand,
  EditorExplicitPsdImportPlanApprovedBatchIntakeCommand,
  EditorExplicitPsdImportPlanPreviewCommand,
  EditorExplicitPsdLayerBatchIntakeCommand,
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
  readonly onIntakeSelectedLayersBatch?: (
    command: EditorExplicitPsdLayerBatchIntakeCommand
  ) => unknown | Promise<unknown>;
  readonly onGenerateImportPlanPreview?: (
    command: EditorExplicitPsdImportPlanPreviewCommand
  ) => unknown | Promise<unknown>;
  readonly onIntakeApprovedImportPlanCandidates?: (
    command: EditorExplicitPsdImportPlanApprovedBatchIntakeCommand
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
      { label: "Selected layer", value: options.viewModel.selectedLayerNodeRef },
      { label: "Selected leaf layers", value: options.viewModel.selectedLayerBatchLabel }
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
    createImportPlanPreviewForm(options),
    createFactSection(
      "Import-Plan Preview",
      editorTestIds.explicitPsdImportPlanPreview,
      [
        { label: "Status", value: options.viewModel.importPlanStatusLabel },
        ...options.viewModel.importPlanFacts
      ]
    ),
    createImportPlanCandidateList(options),
    createTextList(
      "Import-Plan Preview Diagnostics",
      options.viewModel.importPlanDiagnostics,
      editorTestIds.explicitPsdImportPlanDiagnostics
    ),
    createApprovedImportPlanBatchIntakeForm(options),
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
    createBatchLayerIntakeForm(options, parseForm.selectedLayerRefsInput),
    createFactSection(
      "Selected Leaf Layer Batch Result",
      editorTestIds.explicitPsdImportBatchIntakeResult,
      [
        { label: "Status", value: options.viewModel.batchIntakeStatusLabel },
        ...options.viewModel.batchIntakeFacts
      ]
    ),
    createTextList(
      "Selected Leaf Layer Batch Entries",
      options.viewModel.batchIntakeEntryLabels,
      editorTestIds.explicitPsdImportBatchIntakeEntries
    ),
    createTextList(
      "Selected Leaf Layer Batch Diagnostics",
      options.viewModel.batchIntakeDiagnostics,
      editorTestIds.explicitPsdImportBatchIntakeDiagnostics
    ),
    createLayerTree(options.viewModel, parseForm.selectedLayerInput, parseForm.selectedLayerRefsInput),
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

const createImportPlanPreviewForm = (
  options: ExplicitPsdImportPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "explicit-psd-import-form";
  form.dataset.testid = editorTestIds.explicitPsdImportPlanForm;
  form.setAttribute("aria-label", "Create PSD import-plan candidate preview");

  const scopeRef = createTextField({
    label: "Import-plan scope ref",
    name: "importPlanScopeRef",
    value: options.viewModel.importPlanScopeRef
  });
  scopeRef.input.dataset.testid = editorTestIds.explicitPsdImportPlanScopeRef;

  const approvedRefsLabel = document.createElement("label");
  approvedRefsLabel.className = "editor-field editor-field--wide";
  approvedRefsLabel.textContent = "Approved PSD leaf candidate refs";

  const approvedRefs = document.createElement("textarea");
  approvedRefs.name = "importPlanApprovedLayerNodeRefs";
  approvedRefs.value = options.viewModel.importPlanApprovedLayerNodeRefs.join("\n");
  approvedRefs.autocomplete = "off";
  approvedRefs.rows = 3;
  approvedRefs.style.width = "100%";
  approvedRefs.style.boxSizing = "border-box";
  approvedRefs.dataset.testid = editorTestIds.explicitPsdImportPlanApprovedRefs;
  approvedRefs.dataset.lastGeneratedApprovedRefs = serializeSelectedLayerRefs(
    options.viewModel.importPlanApprovedLayerNodeRefs
  );
  approvedRefs.addEventListener("input", () => {
    updateImportPlanApprovedBatchSubmitState(form);
  });
  approvedRefs.addEventListener("change", () => {
    updateImportPlanApprovedBatchSubmitState(form);
  });
  approvedRefsLabel.append(approvedRefs);

  const parentPart = createDestinationParentSelect(
    options,
    "Import-plan destination parent part",
    "importPlanDestinationParentPartId"
  );

  const diagnostics = document.createElement("div");
  diagnostics.className = "explicit-psd-import-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.explicitPsdImportPlanSubmit;
  submit.disabled =
    options.viewModel.status !== "parsed" ||
    options.onGenerateImportPlanPreview === undefined;
  submit.textContent = "Update import-plan preview";

  form.append(scopeRef.field, approvedRefsLabel, parentPart.field, diagnostics, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    diagnostics.replaceChildren();

    try {
      await options.onGenerateImportPlanPreview?.({
        scopeRef: scopeRef.input.value.trim(),
        approvedLayerNodeRefs: parseSelectedLayerRefs(approvedRefs.value),
        destinationParentPartId: parentPart.select.value
      });
    } catch (error) {
      diagnostics.replaceChildren(createDiagnosticLine(formatImportPlanError(error)));
    }
  });

  return form;
};

const createImportPlanCandidateList = (
  options: ExplicitPsdImportPanelOptions
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-section";
  section.dataset.testid = editorTestIds.explicitPsdImportPlanCandidates;
  section.setAttribute("aria-label", "Import-plan approved leaf candidates");

  const heading = document.createElement("h3");
  heading.textContent = "Import-Plan Leaf Candidates";

  const list = document.createElement("ul");
  list.className = "explicit-psd-import-list";
  for (const row of options.viewModel.importPlanCandidateRows) {
    const item = document.createElement("li");
    item.style.overflowWrap = "anywhere";

    const choice = document.createElement("input");
    choice.type = "checkbox";
    choice.name = "explicitPsdImportPlanCandidateApproval";
    choice.value = row.layerRef;
    choice.checked = row.approved;
    choice.disabled = !row.approvalEligible;
    choice.setAttribute(
      "aria-label",
      row.approvalEligible
        ? `Approve PSD leaf candidate ${row.layerRef}`
        : `PSD leaf candidate ${row.layerRef} is not eligible for approval`
    );
    choice.addEventListener("change", () => {
      syncImportPlanApprovedRefs(section);
    });

    const label = document.createElement("span");
    label.textContent = row.label;

    item.append(choice, label);
    list.append(item);
  }

  if (options.viewModel.importPlanCandidateRows.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No import-plan leaf candidates";
    list.append(item);
  }

  section.append(heading, list);
  queueMicrotask(() => syncImportPlanApprovedRefs(section));
  return section;
};

const syncImportPlanApprovedRefs = (root: HTMLElement): void => {
  const form = root.parentElement?.querySelector?.(
    `[data-testid="${editorTestIds.explicitPsdImportPlanForm}"]`
  ) as HTMLFormElement | null | undefined;
  const approvedRefs = form?.querySelector?.(
    `[data-testid="${editorTestIds.explicitPsdImportPlanApprovedRefs}"]`
  ) as HTMLTextAreaElement | null | undefined;
  if (approvedRefs === undefined || approvedRefs === null) {
    return;
  }

  approvedRefs.value = Array.from(
    root.querySelectorAll<HTMLInputElement>('input[name="explicitPsdImportPlanCandidateApproval"]')
  )
    .filter((choice) => choice.checked && !choice.disabled)
    .map((choice) => choice.value)
    .join("\n");
  updateImportPlanApprovedBatchSubmitState(root);
};

const createApprovedImportPlanBatchIntakeForm = (
  options: ExplicitPsdImportPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "explicit-psd-import-form";
  form.dataset.testid = editorTestIds.explicitPsdImportPlanApprovedBatchForm;
  form.setAttribute("aria-label", "Add approved PSD import-plan leaf candidates");

  const parentPart = createDestinationParentSelect(
    options,
    "Approved leaf destination parent part",
    "importPlanApprovedDestinationParentPartId"
  );

  const diagnostics = document.createElement("div");
  diagnostics.className = "explicit-psd-import-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.explicitPsdImportPlanApprovedBatchSubmit;
  submit.disabled =
    options.viewModel.status !== "parsed" ||
    options.viewModel.importPlanApprovedLayerNodeRefs.length === 0 ||
    options.destinationParts.length === 0 ||
    options.onIntakeApprovedImportPlanCandidates === undefined;
  submit.dataset.baseDisabled = submit.disabled ? "true" : "false";
  submit.textContent = "Add approved leaf candidates";

  form.append(parentPart.field, diagnostics, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    diagnostics.replaceChildren();

    const parentPartId = parentPart.select.value.trim();
    if (parentPartId.length === 0) {
      diagnostics.replaceChildren(createDiagnosticLine("Destination parent part is required for approved leaf candidates."));
      return;
    }
    if (!isImportPlanApprovedSelectionCurrent(form)) {
      updateImportPlanApprovedBatchSubmitState(form);
      diagnostics.replaceChildren(createDiagnosticLine("Update the import-plan preview before adding approved leaf candidates."));
      return;
    }

    try {
      await options.onIntakeApprovedImportPlanCandidates?.({
        destinationParentPartId: parentPartId
      });
    } catch (error) {
      diagnostics.replaceChildren(createDiagnosticLine(formatImportPlanError(error)));
    }
  });

  return form;
};

const createExplicitPsdImportForm = (
  options: ExplicitPsdImportPanelOptions
): {
  readonly form: HTMLFormElement;
  readonly selectedLayerInput: HTMLInputElement;
  readonly selectedLayerRefsInput: HTMLTextAreaElement;
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

  const selectedLayerRefsLabel = document.createElement("label");
  selectedLayerRefsLabel.className = "editor-field editor-field--wide";
  selectedLayerRefsLabel.textContent = "Selected PSD leaf layer refs";

  const selectedLayerRefs = document.createElement("textarea");
  selectedLayerRefs.name = "selectedLayerNodeRefs";
  selectedLayerRefs.value = options.viewModel.selectedLayerNodeRefs.join("\n");
  selectedLayerRefs.autocomplete = "off";
  selectedLayerRefs.rows = 3;
  selectedLayerRefs.style.width = "100%";
  selectedLayerRefs.style.boxSizing = "border-box";
  selectedLayerRefs.dataset.testid = editorTestIds.explicitPsdImportBatchLayerRefs;
  selectedLayerRefsLabel.append(selectedLayerRefs);

  const diagnostics = document.createElement("div");
  diagnostics.className = "explicit-psd-import-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.explicitPsdImportSubmit;
  submit.textContent = "Parse PSD";

  form.append(fileLabel, selectedLayerLabel, selectedLayerRefsLabel, diagnostics, submit);
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

  return { form, selectedLayerInput: selectedLayer, selectedLayerRefsInput: selectedLayerRefs };
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

const createBatchLayerIntakeForm = (
  options: ExplicitPsdImportPanelOptions,
  selectedLayerRefsInput: HTMLTextAreaElement
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "explicit-psd-import-form";
  form.dataset.testid = editorTestIds.explicitPsdImportBatchIntakeForm;
  form.setAttribute("aria-label", "Preflight and add explicitly selected PSD leaf layers");

  const parentPart = createSelectField({
    label: "Destination parent part",
    name: "batchDestinationParentPartId",
    options: options.destinationParts.length === 0
      ? [{ value: "", label: "No destination parent parts", disabled: true }]
      : options.destinationParts.map((part) => ({ value: part.partId, label: part.label })),
    value: options.destinationParts[0]?.partId ?? ""
  });

  const diagnostics = document.createElement("div");
  diagnostics.className = "explicit-psd-import-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.explicitPsdImportBatchIntakeSubmit;
  submit.disabled =
    options.viewModel.status !== "parsed" ||
    options.onIntakeSelectedLayersBatch === undefined ||
    options.destinationParts.length === 0;
  submit.textContent = "Preflight and add selected leaf layers";

  form.append(parentPart.field, diagnostics, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    diagnostics.replaceChildren();

    const command = createBatchLayerIntakeCommand({
      selectedLayerNodeRefs: parseSelectedLayerRefs(selectedLayerRefsInput.value),
      parentPartId: parentPart.select.value
    });
    if (command.status === "invalid") {
      diagnostics.replaceChildren(createDiagnosticLine(command.message));
      return;
    }

    try {
      await options.onIntakeSelectedLayersBatch?.(command.command);
    } catch (error) {
      diagnostics.replaceChildren(createDiagnosticLine(formatBatchIntakeError(error)));
    }
  });

  return form;
};

const createBatchLayerIntakeCommand = (input: {
  readonly selectedLayerNodeRefs: readonly string[];
  readonly parentPartId: string;
}):
  | { readonly status: "valid"; readonly command: EditorExplicitPsdLayerBatchIntakeCommand }
  | { readonly status: "invalid"; readonly message: string } => {
  if (input.selectedLayerNodeRefs.length === 0) {
    return {
      status: "invalid",
      message: "Select one or more parsed PSD leaf layers before adding them to generated parts."
    };
  }

  const parentPartId = input.parentPartId.trim();
  if (parentPartId.length === 0) {
    return {
      status: "invalid",
      message: "Destination parent part is required for generated part scaffolds."
    };
  }

  return {
    status: "valid",
    command: {
      selectedLayerNodeRefs: input.selectedLayerNodeRefs,
      destinationParentPartId: parentPartId
    }
  };
};

const parseSelectedLayerRefs = (value: string): readonly string[] =>
  value
    .split(/[\s,]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const serializeSelectedLayerRefs = (refs: readonly string[]): string =>
  refs.join("\n");

const updateImportPlanApprovedBatchSubmitState = (root: HTMLElement): void => {
  const submit = findInRootOrParent<HTMLButtonElement>(
    root,
    `[data-testid="${editorTestIds.explicitPsdImportPlanApprovedBatchSubmit}"]`
  );
  if (submit === null) {
    return;
  }

  const baseDisabled = submit.dataset.baseDisabled === "true";
  submit.disabled = baseDisabled || !isImportPlanApprovedSelectionCurrent(root);
};

const isImportPlanApprovedSelectionCurrent = (root: HTMLElement): boolean => {
  const approvedRefs = findInRootOrParent<HTMLTextAreaElement>(
    root,
    `[data-testid="${editorTestIds.explicitPsdImportPlanApprovedRefs}"]`
  );
  if (approvedRefs === null) {
    return true;
  }

  return areStringArraysEqual(
    parseSelectedLayerRefs(approvedRefs.value),
    parseSelectedLayerRefs(approvedRefs.dataset.lastGeneratedApprovedRefs ?? "")
  );
};

const findInRootOrParent = <T extends HTMLElement>(
  root: HTMLElement,
  selector: string
): T | null => {
  const localMatch = root.querySelector?.(selector) as T | null | undefined;
  if (localMatch !== undefined && localMatch !== null) {
    return localMatch;
  }

  return root.parentElement?.querySelector?.(selector) as T | null | undefined ?? null;
};

const areStringArraysEqual = (
  left: readonly string[],
  right: readonly string[]
): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

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

const createDestinationParentSelect = (
  options: ExplicitPsdImportPanelOptions,
  label: string,
  name: string
): {
  readonly field: HTMLElement;
  readonly select: HTMLSelectElement;
} =>
  createSelectField({
    label,
    name,
    options: options.destinationParts.length === 0
      ? [{ value: "", label: "No destination parent parts", disabled: true }]
      : options.destinationParts.map((part) => ({ value: part.partId, label: part.label })),
    value: options.viewModel.importPlanDestinationParentPartId ||
      options.destinationParts[0]?.partId ||
      ""
  });

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
  selectedLayerInput: HTMLInputElement,
  selectedLayerRefsInput: HTMLTextAreaElement
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
  const batchChoices: HTMLInputElement[] = [];
  const syncBatchRefs = (): void => {
    selectedLayerRefsInput.value = batchChoices
      .filter((choice) => choice.checked && !choice.disabled)
      .map((choice) => choice.value)
      .join("\n");
  };

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
        const batchChoice = batchChoices.find((candidate) => candidate.value === choice.value);
        if (batchChoice !== undefined && !batchChoice.checked) {
          batchChoice.checked = true;
          syncBatchRefs();
        }
      }
    });

    const batchChoice = document.createElement("input");
    batchChoice.type = "checkbox";
    batchChoice.name = "explicitPsdLeafLayerBatchSelection";
    batchChoice.value = row.nodeRef;
    batchChoice.checked = viewModel.selectedLayerNodeRefs.includes(row.nodeRef);
    batchChoice.disabled = row.kind !== "layer";
    batchChoice.setAttribute(
      "aria-label",
      row.kind === "layer"
        ? `Select PSD leaf layer ${row.nodeRef} for batch`
        : `PSD group ${row.nodeRef} is not a leaf layer batch target`
    );
    batchChoice.addEventListener("change", syncBatchRefs);
    batchChoices.push(batchChoice);

    const label = document.createElement("span");
    label.className = "explicit-psd-import-tree__label";
    label.textContent = row.label;

    const meta = document.createElement("span");
    meta.className = "explicit-psd-import-tree__meta";
    meta.textContent = row.metaLabel;

    item.append(choice, batchChoice, label, meta);
    list.append(item);
  }

  syncBatchRefs();
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

const formatBatchIntakeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Explicit PSD leaf layer batch intake failed before workflow state update: ${message}`;
};

const formatImportPlanError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Explicit PSD import-plan preview failed before workflow state update: ${message}`;
};
