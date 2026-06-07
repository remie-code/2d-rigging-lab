import {
  editorTestIds,
  type ExplicitPsdImportViewModel
} from "../../editor-state/index.js";
import type {
  EditorExplicitPsdImportFileCommand,
  EditorExplicitPsdImportPlanApprovedBatchIntakeCommand,
  EditorExplicitPsdImportPlanPreviewCommand,
  EditorExplicitPsdStructuralScaffoldCommitCommand,
  EditorExplicitPsdStructuralScaffoldPreviewCommand,
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
  readonly onGenerateStructuralScaffoldPreview?: (
    command: EditorExplicitPsdStructuralScaffoldPreviewCommand
  ) => unknown | Promise<unknown>;
  readonly onCommitStructuralScaffold?: (
    command: EditorExplicitPsdStructuralScaffoldCommitCommand
  ) => unknown | Promise<unknown>;
}

export type ExplicitPsdImportTaskContentOptions = ExplicitPsdImportPanelOptions;

interface ApprovalBinding {
  readonly choices: HTMLInputElement[];
  readonly lastGeneratedApprovedRefs: readonly string[];
  approvedRefs: HTMLTextAreaElement | null;
  approvedSubmit: HTMLButtonElement | null;
  baseSubmitDisabled: boolean;
}

const createApprovalBinding = (lastGeneratedApprovedRefs: readonly string[]): ApprovalBinding => ({
  choices: [],
  lastGeneratedApprovedRefs: [...lastGeneratedApprovedRefs],
  approvedRefs: null,
  approvedSubmit: null,
  baseSubmitDisabled: true
});

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

  panel.append(heading, meta, createExplicitPsdImportTaskContent(options));

  return panel;
};

export const createExplicitPsdImportTaskContent = (
  options: ExplicitPsdImportTaskContentOptions
): HTMLElement => {
  const content = document.createElement("div");
  content.className = "explicit-psd-import-task-content";

  const parseForm = createExplicitPsdImportForm(options);
  const importPlanApproval = createApprovalBinding(options.viewModel.importPlanApprovedLayerNodeRefs);
  const structuralScaffoldApproval = createApprovalBinding(
    options.viewModel.structuralScaffoldApprovedNodeRefs
  );

  content.append(
    createPrimaryHumanSummary(options),
    createTechnicalWorkflowDetails(
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
      createImportPlanPreviewForm(options, importPlanApproval),
      createFactSection(
        "Import-Plan Preview",
        editorTestIds.explicitPsdImportPlanPreview,
        [
          { label: "Status", value: options.viewModel.importPlanStatusLabel },
          ...options.viewModel.importPlanFacts
        ]
      ),
      createImportPlanCandidateList(options, importPlanApproval),
      createTextList(
        "Import-Plan Preview Diagnostics",
        options.viewModel.importPlanDiagnostics,
        editorTestIds.explicitPsdImportPlanDiagnostics
      ),
      createApprovedImportPlanBatchIntakeForm(options, importPlanApproval),
      createStructuralScaffoldPreviewForm(options, structuralScaffoldApproval),
      createFactSection(
        "Structural Scaffold Preview",
        editorTestIds.explicitPsdStructuralScaffoldPreview,
        [
          { label: "Status", value: options.viewModel.structuralScaffoldStatusLabel },
          ...options.viewModel.structuralScaffoldFacts
        ]
      ),
      createStructuralScaffoldNodeList(options, structuralScaffoldApproval),
      createTextList(
        "Structural Scaffold Preview Diagnostics",
        options.viewModel.structuralScaffoldDiagnostics,
        editorTestIds.explicitPsdStructuralScaffoldDiagnostics
      ),
      createApprovedStructuralScaffoldCommitForm(options, structuralScaffoldApproval),
      createFactSection(
        "Structural Scaffold Result",
        editorTestIds.explicitPsdStructuralScaffoldResult,
        [
          { label: "Status", value: options.viewModel.structuralScaffoldIntakeStatusLabel },
          ...options.viewModel.structuralScaffoldIntakeFacts
        ]
      ),
      createTextList(
        "Structural Scaffold Entries",
        options.viewModel.structuralScaffoldIntakeEntryLabels,
        editorTestIds.explicitPsdStructuralScaffoldEntries
      ),
      createTextList(
        "Structural Scaffold Result Diagnostics",
        options.viewModel.structuralScaffoldIntakeDiagnostics,
        editorTestIds.explicitPsdStructuralScaffoldResultDiagnostics
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
    )
  );

  return content;
};

const createPrimaryHumanSummary = (
  options: ExplicitPsdImportTaskContentOptions
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-task-summary";
  section.setAttribute("aria-label", "PSD import task human summary");

  const heading = document.createElement("h3");
  heading.textContent = "Task Summary";

  const facts = document.createElement("dl");
  facts.className = "source-intake-summary explicit-psd-import-task-summary__facts";
  appendFact(facts, "Source", formatSourceSummary(options.viewModel));
  appendFact(facts, "Parse state", options.viewModel.statusLabel);
  appendFact(facts, "Tree state", formatTreeSummary(options.viewModel));
  appendFact(facts, "Import-plan scope", formatImportPlanScopeSummary(options));
  appendFact(facts, "Structural preview", formatStructuralPreviewSummary(options.viewModel));
  appendFact(facts, "Warning summary", formatWarningSummary(options.viewModel));
  appendFact(facts, "Approval and commit", formatApprovalCommitSummary(options.viewModel));

  section.append(heading, facts);
  return section;
};

const createTechnicalWorkflowDetails = (...nodes: readonly HTMLElement[]): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-task-details";
  section.setAttribute("aria-label", "PSD import technical workflow details");

  const heading = document.createElement("h3");
  heading.textContent = "Technical Workflow Details";
  section.append(heading, ...nodes);
  return section;
};

const formatSourceSummary = (viewModel: ExplicitPsdImportViewModel): string => {
  const filename = findFactValue(viewModel.sourceFacts, "Filename");
  if (filename === undefined) {
    return findFactValue(viewModel.sourceFacts, "Input") ?? "No source selected";
  }

  const byteLength = findFactValue(viewModel.sourceFacts, "Byte length");
  return byteLength === undefined ? filename : `${filename} / ${byteLength}`;
};

const formatTreeSummary = (viewModel: ExplicitPsdImportViewModel): string => {
  const groups = findFactValue(viewModel.documentFacts, "Groups");
  const layers = findFactValue(viewModel.documentFacts, "Layers");
  if (groups === undefined || layers === undefined) {
    return "No parsed PSD tree";
  }

  return [
    `${groups} groups`,
    `${layers} layers`,
    `${findFactValue(viewModel.documentFacts, "Visible layers") ?? "0"} visible`,
    `${findFactValue(viewModel.documentFacts, "Hidden layers") ?? "0"} hidden`
  ].join(" / ");
};

const formatImportPlanScopeSummary = (
  options: ExplicitPsdImportTaskContentOptions
): string => {
  const candidateCounts = formatImportPlanCandidateCounts(
    findFactValue(options.viewModel.importPlanFacts, "Candidates / eligible / approved / not-approved")
  );

  return [
    formatPsdScopeLabel(options.viewModel.importPlanScopeRef),
    formatDestinationParentLabel(options),
    options.viewModel.importPlanStatusLabel,
    candidateCounts
  ].join(" / ");
};

const formatStructuralPreviewSummary = (viewModel: ExplicitPsdImportViewModel): string => {
  const sourceCounts = formatStructuralSourceCounts(
    findFactValue(viewModel.structuralScaffoldFacts, "Groups / leaves / approved groups / approved leaves")
  );
  const outputCounts = formatStructuralOutputCounts(
    findFactValue(viewModel.structuralScaffoldFacts, "Generated group parts / drawables")
  );
  const hiddenCounts = formatStructuralHiddenCounts(
    findFactValue(viewModel.structuralScaffoldFacts, "Hidden leaves / runtime-hidden drawables")
  );

  return [viewModel.structuralScaffoldStatusLabel, sourceCounts, outputCounts, hiddenCounts].join(" / ");
};

const formatWarningSummary = (viewModel: ExplicitPsdImportViewModel): string => {
  const reviewCounts = formatImportPlanReviewCounts(
    findFactValue(viewModel.importPlanFacts, "Hidden / unsupported / collisions / byte blocked")
  );
  const diagnosticCount = countHumanDiagnostics([
    ...viewModel.diagnostics,
    ...viewModel.importPlanDiagnostics,
    ...viewModel.structuralScaffoldDiagnostics,
    ...viewModel.batchIntakeDiagnostics,
    ...viewModel.structuralScaffoldIntakeDiagnostics
  ]);

  return [
    `unsupported ${findFactValue(viewModel.featureFacts, "Unsupported") ?? "0"}`,
    `not evaluated ${findFactValue(viewModel.featureFacts, "Not evaluated") ?? "0"}`,
    reviewCounts,
    `${diagnosticCount} diagnostics needing review`
  ].join(" / ");
};

const formatApprovalCommitSummary = (viewModel: ExplicitPsdImportViewModel): string => {
  const approvedLeafCount = parseDelimitedCounts(
    findFactValue(viewModel.importPlanFacts, "Candidates / eligible / approved / not-approved")
  )[2] ?? String(viewModel.importPlanApprovedLayerNodeRefs.length);
  const structuralApproval =
    findFactValue(viewModel.structuralScaffoldFacts, "Approval status") ?? "No structural approval yet";

  return [
    `${approvedLeafCount} approved import-plan leaves`,
    `structural approval ${structuralApproval}`,
    `approved import ${viewModel.batchIntakeStatusLabel}`,
    `structural commit ${viewModel.structuralScaffoldIntakeStatusLabel}`
  ].join(" / ");
};

const formatPsdScopeLabel = (scopeRef: string): string => {
  const normalized = scopeRef.trim();
  if (normalized.length === 0 || normalized === "psd:root") {
    return "root PSD scope";
  }

  return "selected PSD scope";
};

const formatDestinationParentLabel = (
  options: ExplicitPsdImportTaskContentOptions
): string => {
  const destinationPartId =
    options.viewModel.importPlanDestinationParentPartId ||
    options.viewModel.structuralScaffoldDestinationParentPartId;
  if (destinationPartId.trim().length === 0) {
    return "No destination parent selected";
  }

  const partLabel = options.destinationParts.find((part) => part.partId === destinationPartId)?.label;
  if (partLabel === undefined) {
    return "selected destination parent";
  }

  return `destination ${partLabel.split(" / ")[0]?.trim() || "selected parent"}`;
};

const formatImportPlanCandidateCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 4) {
    return "No import-plan candidates yet";
  }

  return `${counts[0]} candidates / ${counts[1]} eligible / ${counts[2]} approved / ${counts[3]} waiting`;
};

const formatImportPlanReviewCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 4) {
    return "import review not generated";
  }

  return `${counts[0]} hidden / ${counts[1]} unsupported / ${counts[2]} collisions / ${counts[3]} byte blocked`;
};

const formatStructuralSourceCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 4) {
    return "No structural source counts";
  }

  return `${counts[0]} groups / ${counts[1]} leaves / ${counts[2]} approved groups / ${counts[3]} approved leaves`;
};

const formatStructuralOutputCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 2) {
    return "No structural output counts";
  }

  return `${counts[0]} part containers / ${counts[1]} drawables`;
};

const formatStructuralHiddenCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 2) {
    return "No hidden structural drawables";
  }

  return `${counts[0]} hidden leaves / ${counts[1]} runtime-hidden drawables`;
};

const parseDelimitedCounts = (value: string | undefined): readonly string[] =>
  value?.split(" / ").map((part) => part.trim()).filter((part) => part.length > 0) ?? [];

const countHumanDiagnostics = (items: readonly string[]): number =>
  items.filter((item) => !isEmptyDiagnosticLabel(item)).length;

const isEmptyDiagnosticLabel = (item: string): boolean =>
  /^No .+diagnostics$/i.test(item.trim()) ||
  item.trim().toLowerCase() === "no psd parser diagnostics";

const findFactValue = (
  facts: readonly {
    readonly label: string;
    readonly value: string;
  }[],
  label: string
): string | undefined =>
  facts.find((fact) => fact.label === label)?.value;

const createImportPlanPreviewForm = (
  options: ExplicitPsdImportPanelOptions,
  approval: ApprovalBinding
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
  approval.approvedRefs = approvedRefs;
  approvedRefs.addEventListener("input", () => {
    updateApprovalSubmitState(approval);
  });
  approvedRefs.addEventListener("change", () => {
    updateApprovalSubmitState(approval);
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
  options: ExplicitPsdImportPanelOptions,
  approval: ApprovalBinding
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
      syncApprovedRefsFromChoices(approval);
    });
    approval.choices.push(choice);

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
  queueMicrotask(() => syncApprovedRefsFromChoices(approval));
  return section;
};

const createApprovedImportPlanBatchIntakeForm = (
  options: ExplicitPsdImportPanelOptions,
  approval: ApprovalBinding
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
  approval.approvedSubmit = submit;
  approval.baseSubmitDisabled = submit.disabled;
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
    if (!isApprovalSelectionCurrent(approval)) {
      updateApprovalSubmitState(approval);
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

const createStructuralScaffoldPreviewForm = (
  options: ExplicitPsdImportPanelOptions,
  approval: ApprovalBinding
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "explicit-psd-import-form";
  form.dataset.testid = editorTestIds.explicitPsdStructuralScaffoldForm;
  form.setAttribute("aria-label", "Create PSD structural scaffold preview");

  const scopeRef = createTextField({
    label: "Structural scaffold scope ref",
    name: "structuralScaffoldScopeRef",
    value: options.viewModel.structuralScaffoldScopeRef
  });
  scopeRef.input.dataset.testid = editorTestIds.explicitPsdStructuralScaffoldScopeRef;

  const approvedRefsLabel = document.createElement("label");
  approvedRefsLabel.className = "editor-field editor-field--wide";
  approvedRefsLabel.textContent = "Approved PSD structural refs";

  const approvedRefs = document.createElement("textarea");
  approvedRefs.name = "structuralScaffoldApprovedNodeRefs";
  approvedRefs.value = options.viewModel.structuralScaffoldApprovedNodeRefs.join("\n");
  approvedRefs.autocomplete = "off";
  approvedRefs.rows = 3;
  approvedRefs.style.width = "100%";
  approvedRefs.style.boxSizing = "border-box";
  approvedRefs.dataset.testid = editorTestIds.explicitPsdStructuralScaffoldApprovedRefs;
  approval.approvedRefs = approvedRefs;
  approvedRefs.addEventListener("input", () => {
    updateApprovalSubmitState(approval);
  });
  approvedRefs.addEventListener("change", () => {
    updateApprovalSubmitState(approval);
  });
  approvedRefsLabel.append(approvedRefs);

  const parentPart = createSelectField({
    label: "Structural scaffold destination parent part",
    name: "structuralScaffoldDestinationParentPartId",
    options: options.destinationParts.length === 0
      ? [{ value: "", label: "No destination parent parts", disabled: true }]
      : options.destinationParts.map((part) => ({ value: part.partId, label: part.label })),
    value: options.viewModel.structuralScaffoldDestinationParentPartId ||
      options.destinationParts[0]?.partId ||
      ""
  });

  const diagnostics = document.createElement("div");
  diagnostics.className = "explicit-psd-import-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.explicitPsdStructuralScaffoldSubmit;
  submit.disabled =
    options.viewModel.status !== "parsed" ||
    options.onGenerateStructuralScaffoldPreview === undefined ||
    options.destinationParts.length === 0;
  submit.textContent = "Update structural scaffold preview";

  form.append(scopeRef.field, approvedRefsLabel, parentPart.field, diagnostics, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    diagnostics.replaceChildren();

    try {
      await options.onGenerateStructuralScaffoldPreview?.({
        scopeRef: scopeRef.input.value.trim(),
        approvedNodeRefs: parseSelectedLayerRefs(approvedRefs.value),
        destinationParentPartId: parentPart.select.value
      });
    } catch (error) {
      diagnostics.replaceChildren(createDiagnosticLine(formatStructuralScaffoldError(error)));
    }
  });

  return form;
};

const createStructuralScaffoldNodeList = (
  options: ExplicitPsdImportPanelOptions,
  approval: ApprovalBinding
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-section";
  section.dataset.testid = editorTestIds.explicitPsdStructuralScaffoldNodes;
  section.setAttribute("aria-label", "Structural scaffold approved PSD nodes");

  const heading = document.createElement("h3");
  heading.textContent = "Structural Scaffold Nodes";

  const list = document.createElement("ul");
  list.className = "explicit-psd-import-list";
  for (const row of options.viewModel.structuralScaffoldNodeRows) {
    const item = document.createElement("li");
    item.style.overflowWrap = "anywhere";

    const choice = document.createElement("input");
    choice.type = "checkbox";
    choice.name = "explicitPsdStructuralScaffoldApproval";
    choice.value = row.nodeRef;
    choice.checked = row.approved;
    choice.disabled = !row.approvalEligible;
    choice.setAttribute(
      "aria-label",
      row.approvalEligible
        ? `Approve PSD structural ${row.kind} ${row.nodeRef}`
        : `PSD structural ${row.kind} ${row.nodeRef} is not eligible for approval`
    );
    choice.addEventListener("change", () => {
      syncApprovedRefsFromChoices(approval);
    });
    approval.choices.push(choice);

    const label = document.createElement("span");
    label.textContent = row.label;

    item.append(choice, label);
    list.append(item);
  }

  if (options.viewModel.structuralScaffoldNodeRows.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No structural scaffold nodes";
    list.append(item);
  }

  section.append(heading, list);
  queueMicrotask(() => syncApprovedRefsFromChoices(approval));
  return section;
};

const createApprovedStructuralScaffoldCommitForm = (
  options: ExplicitPsdImportPanelOptions,
  approval: ApprovalBinding
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "explicit-psd-import-form";
  form.dataset.testid = editorTestIds.explicitPsdStructuralScaffoldApprovedForm;
  form.setAttribute("aria-label", "Add approved PSD structural scaffold");

  const parentPart = createSelectField({
    label: "Approved structural scaffold destination parent part",
    name: "structuralScaffoldApprovedDestinationParentPartId",
    options: options.destinationParts.length === 0
      ? [{ value: "", label: "No destination parent parts", disabled: true }]
      : options.destinationParts.map((part) => ({ value: part.partId, label: part.label })),
    value: options.viewModel.structuralScaffoldDestinationParentPartId ||
      options.destinationParts[0]?.partId ||
      ""
  });

  const diagnostics = document.createElement("div");
  diagnostics.className = "explicit-psd-import-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.explicitPsdStructuralScaffoldApprovedSubmit;
  submit.disabled =
    options.viewModel.status !== "parsed" ||
    options.viewModel.structuralScaffoldApprovedNodeRefs.length === 0 ||
    options.destinationParts.length === 0 ||
    options.onCommitStructuralScaffold === undefined;
  approval.approvedSubmit = submit;
  approval.baseSubmitDisabled = submit.disabled;
  submit.textContent = "Add approved structural scaffold";

  form.append(parentPart.field, diagnostics, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    diagnostics.replaceChildren();

    const parentPartId = parentPart.select.value.trim();
    if (parentPartId.length === 0) {
      diagnostics.replaceChildren(createDiagnosticLine("Destination parent part is required for structural scaffold execution."));
      return;
    }
    if (!isApprovalSelectionCurrent(approval)) {
      updateApprovalSubmitState(approval);
      diagnostics.replaceChildren(createDiagnosticLine("Update the structural scaffold preview before adding approved structural nodes."));
      return;
    }

    try {
      await options.onCommitStructuralScaffold?.({
        destinationParentPartId: parentPartId
      });
    } catch (error) {
      diagnostics.replaceChildren(createDiagnosticLine(formatStructuralScaffoldError(error)));
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

const syncApprovedRefsFromChoices = (approval: ApprovalBinding): void => {
  if (approval.approvedRefs === null) {
    return;
  }

  approval.approvedRefs.value = serializeSelectedLayerRefs(
    approval.choices
      .filter((choice) => choice.checked && !choice.disabled)
      .map((choice) => choice.value)
  );
  updateApprovalSubmitState(approval);
};

const updateApprovalSubmitState = (approval: ApprovalBinding): void => {
  if (approval.approvedSubmit === null) {
    return;
  }

  approval.approvedSubmit.disabled =
    approval.baseSubmitDisabled || !isApprovalSelectionCurrent(approval);
};

const isApprovalSelectionCurrent = (approval: ApprovalBinding): boolean => {
  if (approval.approvedRefs === null) {
    return true;
  }

  return areStringArraysEqual(
    parseSelectedLayerRefs(approval.approvedRefs.value),
    approval.lastGeneratedApprovedRefs
  );
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

const formatStructuralScaffoldError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Explicit PSD structural scaffold failed before workflow state update: ${message}`;
};
