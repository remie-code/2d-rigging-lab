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
import { createExplicitPsdImportTaskSummary } from "./explicit-psd-import-task-summary.js";

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
    createExplicitPsdImportTaskSummary(options),
    createHumanTaskSection(
      "Choose PSD file",
      "PSD import source selection",
      parseForm.form,
      createFactSection("Parse status", editorTestIds.explicitPsdImportStatus, [
        { label: "Status", value: options.viewModel.statusLabel },
        { label: "Selected layers", value: formatSelectedLeafLayerCount(options.viewModel) }
      ]),
      createFactSection(
        "Source",
        editorTestIds.explicitPsdImportSource,
        projectSourceHumanFacts(options.viewModel),
        [createHiddenFactList("Source technical facts", options.viewModel.sourceFacts)]
      ),
      createFactSection(
        "Document",
        editorTestIds.explicitPsdImportDocument,
        projectDocumentHumanFacts(options.viewModel),
        [createHiddenFactList("Document technical facts", options.viewModel.documentFacts)]
      ),
      createFactSection(
        "Format review",
        editorTestIds.explicitPsdImportFeatureSupport,
        projectFeatureReviewHumanFacts(options.viewModel),
        [
          createHiddenFactList("Feature technical facts", options.viewModel.featureFacts),
          createHiddenTextList("Unsupported feature evidence", options.viewModel.unsupportedFeatureLabels),
          createHiddenTextList("Not evaluated feature evidence", options.viewModel.notEvaluatedFeatureLabels)
        ]
      )
    ),
    createHumanTaskSection(
      "PSD structure",
      "PSD structure tree",
      createLayerTree(options.viewModel, parseForm.selectedLayerInput, parseForm.selectedLayerRefsInput)
    ),
    createHumanTaskSection(
      "Scope and preview",
      "PSD import scope and preview",
      createWorkflowStage(
        "Leaf import preview",
        createImportPlanPreviewForm(options, importPlanApproval),
        createFactSection(
          "Import preview",
          editorTestIds.explicitPsdImportPlanPreview,
          projectImportPlanHumanFacts(options),
          [createHiddenFactList("Import preview technical facts", options.viewModel.importPlanFacts)]
        ),
        createImportPlanCandidateList(options, importPlanApproval),
        createDiagnosticSummarySection(
          "Import preview warnings",
          options.viewModel.importPlanDiagnostics,
          editorTestIds.explicitPsdImportPlanDiagnostics
        )
      ),
      createWorkflowStage(
        "Structure scaffold preview",
        createStructuralScaffoldPreviewForm(options, structuralScaffoldApproval),
        createFactSection(
          "Structure preview",
          editorTestIds.explicitPsdStructuralScaffoldPreview,
          projectStructuralScaffoldHumanFacts(options),
          [
            createHiddenFactList(
              "Structure preview technical facts",
              options.viewModel.structuralScaffoldFacts
            )
          ]
        ),
        createStructuralScaffoldNodeList(options, structuralScaffoldApproval),
        createDiagnosticSummarySection(
          "Structure preview warnings",
          options.viewModel.structuralScaffoldDiagnostics,
          editorTestIds.explicitPsdStructuralScaffoldDiagnostics
        )
      )
    ),
    createHumanTaskSection(
      "Import and commit",
      "PSD import commit actions",
      createWorkflowStage(
        "Approved leaf import",
        createApprovedImportPlanBatchIntakeForm(options, importPlanApproval),
        createResultSummarySection(
          "Approved leaf result",
          editorTestIds.explicitPsdImportBatchIntakeResult,
          options.viewModel.batchIntakeStatusLabel,
          options.viewModel.batchIntakeFacts
        ),
        createResultListSummarySection(
          "Approved leaf entries",
          options.viewModel.batchIntakeEntryLabels,
          editorTestIds.explicitPsdImportBatchIntakeEntries
        ),
        createDiagnosticSummarySection(
          "Approved leaf warnings",
          options.viewModel.batchIntakeDiagnostics,
          editorTestIds.explicitPsdImportBatchIntakeDiagnostics
        )
      ),
      createWorkflowStage(
        "Approved structure commit",
        createApprovedStructuralScaffoldCommitForm(options, structuralScaffoldApproval)
      ),
      createWorkflowStage(
        "Commit result",
        createFactSection(
          "Structure commit",
          editorTestIds.explicitPsdStructuralScaffoldResult,
          projectResultHumanFacts(
            options.viewModel.structuralScaffoldIntakeStatusLabel,
            options.viewModel.structuralScaffoldIntakeFacts
          ),
          [
            createHiddenFactList(
              "Structure commit technical facts",
              options.viewModel.structuralScaffoldIntakeFacts
            )
          ]
        ),
        createResultListSummarySection(
          "Structure commit entries",
          options.viewModel.structuralScaffoldIntakeEntryLabels,
          editorTestIds.explicitPsdStructuralScaffoldEntries
        ),
        createDiagnosticSummarySection(
          "Structure commit warnings",
          options.viewModel.structuralScaffoldIntakeDiagnostics,
          editorTestIds.explicitPsdStructuralScaffoldResultDiagnostics
        )
      )
    ),
    createHumanTaskSection(
      "Additional import actions",
      "PSD import additional import actions",
      createWorkflowStage(
        "Selected layer import",
        createLayerIntakeForm(options, parseForm.selectedLayerInput),
        createResultSummarySection(
          "Selected layer result",
          editorTestIds.explicitPsdImportLayerIntakeResult,
          options.viewModel.intakeStatusLabel,
          options.viewModel.intakeFacts
        ),
        createDiagnosticSummarySection(
          "Selected layer warnings",
          options.viewModel.intakeDiagnostics,
          editorTestIds.explicitPsdImportLayerIntakeDiagnostics
        )
      ),
      createWorkflowStage(
        "Selected leaf batch import",
        createBatchLayerIntakeForm(options, parseForm.selectedLayerRefsInput)
      ),
      createWorkflowStage(
        "Session notes",
        createResultListSummarySection(
          "Selected layer media",
          options.viewModel.materializationLabels,
          editorTestIds.explicitPsdImportMaterialization
        ),
        createFactSection(
          "Session persistence",
          editorTestIds.explicitPsdImportPersistence,
          projectPersistenceHumanFacts(options.viewModel),
          [createHiddenFactList("Persistence technical facts", options.viewModel.persistenceFacts)]
        ),
        createDiagnosticSummarySection(
          "Parser warnings",
          options.viewModel.diagnostics,
          editorTestIds.explicitPsdImportDiagnostics
        )
      )
    )
  );

  return content;
};

const createHumanTaskSection = (
  headingText: string,
  ariaLabel: string,
  ...nodes: readonly HTMLElement[]
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-task-details explicit-psd-import-human-section";
  section.setAttribute("aria-label", ariaLabel);

  const heading = document.createElement("h3");
  heading.textContent = headingText;
  section.append(heading, ...nodes);
  return section;
};

const createWorkflowStage = (
  headingText: string,
  ...nodes: readonly HTMLElement[]
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-section explicit-psd-import-task-stage";
  section.setAttribute("aria-label", headingText);

  const heading = document.createElement("h3");
  heading.textContent = headingText;
  section.append(heading, ...nodes);
  return section;
};

const formatSelectedLeafLayerCount = (viewModel: ExplicitPsdImportViewModel): string => {
  const count = viewModel.selectedLayerNodeRefs.length;
  if (count === 0) {
    return "No selected PSD leaf layers";
  }

  return `${count} selected PSD leaf layer${count === 1 ? "" : "s"}`;
};

const projectSourceHumanFacts = (
  viewModel: ExplicitPsdImportViewModel
): readonly { readonly label: string; readonly value: string }[] => {
  const filename = findFactValue(viewModel.sourceFacts, "Filename");
  if (filename === undefined) {
    return [
      { label: "File", value: "Choose a local PSD file" },
      { label: "Limit", value: findFactValue(viewModel.sourceFacts, "Size cap") ?? "Browser parser size limit applies" }
    ];
  }

  return [
    { label: "File", value: filename },
    { label: "Size", value: findFactValue(viewModel.sourceFacts, "Byte length") ?? "Size unavailable" },
    {
      label: "Type",
      value: findFactValue(viewModel.sourceFacts, "Declared media type") ?? "No declared media type"
    },
    { label: "Handling", value: "Local browser-session parse" }
  ];
};

const projectDocumentHumanFacts = (
  viewModel: ExplicitPsdImportViewModel
): readonly { readonly label: string; readonly value: string }[] => {
  const groups = findFactValue(viewModel.documentFacts, "Groups");
  const layers = findFactValue(viewModel.documentFacts, "Layers");
  if (groups === undefined || layers === undefined) {
    return [{ label: "Tree", value: "No parsed PSD structure yet" }];
  }

  return [
    { label: "Canvas", value: findFactValue(viewModel.documentFacts, "Canvas") ?? "Canvas unavailable" },
    { label: "Groups", value: groups },
    { label: "Layers", value: layers },
    { label: "Visible layers", value: findFactValue(viewModel.documentFacts, "Visible layers") ?? "0" },
    { label: "Hidden layers", value: findFactValue(viewModel.documentFacts, "Hidden layers") ?? "0" },
    { label: "Raster candidates", value: findFactValue(viewModel.documentFacts, "Raster candidates") ?? "0" }
  ];
};

const projectFeatureReviewHumanFacts = (
  viewModel: ExplicitPsdImportViewModel
): readonly { readonly label: string; readonly value: string }[] => [
  { label: "Unsupported items", value: findFactValue(viewModel.featureFacts, "Unsupported") ?? "0" },
  { label: "Needs review", value: findFactValue(viewModel.featureFacts, "Not evaluated") ?? "0" }
];

const projectImportPlanHumanFacts = (
  options: ExplicitPsdImportPanelOptions
): readonly { readonly label: string; readonly value: string }[] => [
  { label: "Status", value: options.viewModel.importPlanStatusLabel },
  { label: "Scope", value: formatPsdScopeLabel(options.viewModel.importPlanScopeRef) },
  {
    label: "Target",
    value: formatDestinationParentLabel(options.destinationParts, options.viewModel.importPlanDestinationParentPartId)
  },
  {
    label: "Candidates",
    value: formatImportPlanCandidateCounts(
      findFactValue(options.viewModel.importPlanFacts, "Candidates / eligible / approved / not-approved")
    )
  },
  {
    label: "Warnings",
    value: formatImportPlanReviewCounts(
      findFactValue(options.viewModel.importPlanFacts, "Hidden / unsupported / collisions / byte blocked")
    )
  },
  {
    label: "Approved size",
    value: formatApprovedByteEstimate(
      findFactValue(options.viewModel.importPlanFacts, "Byte estimate total / approved")
    )
  }
];

const projectStructuralScaffoldHumanFacts = (
  options: ExplicitPsdImportPanelOptions
): readonly { readonly label: string; readonly value: string }[] => [
  { label: "Status", value: options.viewModel.structuralScaffoldStatusLabel },
  { label: "Scope", value: formatPsdScopeLabel(options.viewModel.structuralScaffoldScopeRef) },
  {
    label: "Target",
    value: formatDestinationParentLabel(
      options.destinationParts,
      options.viewModel.structuralScaffoldDestinationParentPartId
    )
  },
  {
    label: "Approval",
    value: findFactValue(options.viewModel.structuralScaffoldFacts, "Approval status") ??
      "No structural approval yet"
  },
  {
    label: "Source",
    value: formatStructuralSourceCounts(
      findFactValue(options.viewModel.structuralScaffoldFacts, "Groups / leaves / approved groups / approved leaves")
    )
  },
  {
    label: "Output",
    value: formatStructuralOutputCounts(
      findFactValue(options.viewModel.structuralScaffoldFacts, "Generated group parts / drawables")
    )
  },
  {
    label: "Visibility",
    value: formatStructuralHiddenCounts(
      findFactValue(options.viewModel.structuralScaffoldFacts, "Hidden leaves / runtime-hidden drawables")
    )
  }
];

const projectResultHumanFacts = (
  statusLabel: string,
  facts: readonly { readonly label: string; readonly value: string }[]
): readonly { readonly label: string; readonly value: string }[] => {
  const safeFacts = facts.filter((fact) => isHumanResultFact(fact.label));
  return [
    { label: "Status", value: statusLabel },
    ...(safeFacts.length === 0 ? [{ label: "Result", value: "No committed import result yet" }] : safeFacts)
  ];
};

const projectPersistenceHumanFacts = (
  viewModel: ExplicitPsdImportViewModel
): readonly { readonly label: string; readonly value: string }[] => [
  { label: "Parser session", value: "Temporary browser task session" },
  { label: "Project reload", value: "Re-select the PSD file before generating new previews" },
  {
    label: "Save/load",
    value: humanizePersistenceBoundary(findFactValue(viewModel.persistenceFacts, "Save/load"))
  }
];

const createResultSummarySection = (
  headingText: string,
  testId: string,
  statusLabel: string,
  facts: readonly { readonly label: string; readonly value: string }[]
): HTMLElement =>
  createFactSection(headingText, testId, projectResultHumanFacts(statusLabel, facts), [
    createHiddenFactList(`${headingText} technical facts`, facts)
  ]);

const createDiagnosticSummarySection = (
  headingText: string,
  items: readonly string[],
  testId: string
): HTMLElement => {
  const count = countHumanDiagnostics(items);
  const message = count === 0
    ? "No issues need review"
    : `${count} issue${count === 1 ? "" : "s"} need review before commit`;

  return createFactSection(headingText, testId, [{ label: "Review", value: message }], [
    createHiddenTextList(`${headingText} technical diagnostics`, items)
  ]);
};

const createResultListSummarySection = (
  headingText: string,
  items: readonly string[],
  testId: string
): HTMLElement => {
  const count = countHumanDiagnostics(items);
  const value = count === 0 ? "No committed entries yet" : `${count} committed entr${count === 1 ? "y" : "ies"}`;

  return createFactSection(headingText, testId, [{ label: "Entries", value }], [
    createHiddenTextList(`${headingText} technical entries`, items)
  ]);
};

const isHumanResultFact = (label: string): boolean =>
  [
    "Result",
    "Requested / success / failure",
    "Materialization requested / success / failure",
    "Destination kind",
    "Generated parts",
    "Generated drawables",
    "Generated textures",
    "Generated meshes",
    "Runtime-hidden drawables"
  ].includes(label);

const formatApprovedByteEstimate = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 2) {
    return "No approved size estimate";
  }

  return counts[1] ?? "No approved size estimate";
};

const humanizePersistenceBoundary = (value: string | undefined): string => {
  if (value === undefined) {
    return "Project state can be saved after committed imports";
  }

  if (/reparse/i.test(value)) {
    return "Re-parse required after reload";
  }

  return "Project state can be saved after committed imports";
};

const createImportPlanPreviewForm = (
  options: ExplicitPsdImportPanelOptions,
  approval: ApprovalBinding
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "explicit-psd-import-form";
  form.dataset.testid = editorTestIds.explicitPsdImportPlanForm;
  form.setAttribute("aria-label", "Create PSD import-plan candidate preview");

  const scopeRef = createTextField({
    label: "Import-plan scope",
    name: "importPlanScopeRef",
    value: options.viewModel.importPlanScopeRef
  });
  scopeRef.input.dataset.testid = editorTestIds.explicitPsdImportPlanScopeRef;
  hideTechnicalField(scopeRef.field);

  const approvedRefsLabel = document.createElement("label");
  approvedRefsLabel.className = "editor-field editor-field--wide";
  approvedRefsLabel.textContent = "Approved PSD leaf candidates";
  hideTechnicalField(approvedRefsLabel);

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
  submit.textContent = "Preview approved leaves";

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
  heading.textContent = "Leaf candidates";

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
        ? `Approve PSD leaf candidate ${formatImportPlanCandidateName(row.label)}`
        : `PSD leaf candidate ${formatImportPlanCandidateName(row.label)} is not eligible for approval`
    );
    choice.addEventListener("change", () => {
      syncApprovedRefsFromChoices(approval);
    });
    approval.choices.push(choice);

    const label = document.createElement("span");
    label.textContent = formatImportPlanCandidateHumanLabel(row);

    item.append(choice, label);
    list.append(item);
  }

  if (options.viewModel.importPlanCandidateRows.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No import-plan leaf candidates";
    list.append(item);
  }

  section.append(
    heading,
    list,
    createHiddenTextList(
      "Import-plan candidate technical rows",
      options.viewModel.importPlanCandidateLabels
    )
  );
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
  submit.textContent = "Import approved leaves";

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
    label: "Structural scaffold scope",
    name: "structuralScaffoldScopeRef",
    value: options.viewModel.structuralScaffoldScopeRef
  });
  scopeRef.input.dataset.testid = editorTestIds.explicitPsdStructuralScaffoldScopeRef;
  hideTechnicalField(scopeRef.field);

  const approvedRefsLabel = document.createElement("label");
  approvedRefsLabel.className = "editor-field editor-field--wide";
  approvedRefsLabel.textContent = "Approved PSD structural nodes";
  hideTechnicalField(approvedRefsLabel);

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
      : options.destinationParts.map((part) => ({ value: part.partId, label: formatPartOptionLabel(part.label) })),
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
  submit.textContent = "Preview approved structure";

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
  heading.textContent = "Structure nodes";

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
        ? `Approve PSD ${row.kind} ${formatStructuralScaffoldNodeName(row.label)}`
        : `PSD ${row.kind} ${formatStructuralScaffoldNodeName(row.label)} is not eligible for approval`
    );
    choice.addEventListener("change", () => {
      syncApprovedRefsFromChoices(approval);
    });
    approval.choices.push(choice);

    const label = document.createElement("span");
    label.textContent = formatStructuralScaffoldNodeHumanLabel(row);

    item.append(choice, label);
    list.append(item);
  }

  if (options.viewModel.structuralScaffoldNodeRows.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No structural scaffold nodes";
    list.append(item);
  }

  section.append(
    heading,
    list,
    createHiddenTextList(
      "Structural scaffold node technical rows",
      options.viewModel.structuralScaffoldNodeLabels
    )
  );
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
      : options.destinationParts.map((part) => ({ value: part.partId, label: formatPartOptionLabel(part.label) })),
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
  submit.textContent = "Commit approved structure";

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
  selectedLayerLabel.textContent = "Initial selected layer";
  hideTechnicalField(selectedLayerLabel);

  const selectedLayer = document.createElement("input");
  selectedLayer.name = "selectedLayerNodeRef";
  selectedLayer.type = "text";
  selectedLayer.value = options.viewModel.selectedLayerNodeRef;
  selectedLayer.autocomplete = "off";
  selectedLayer.dataset.testid = editorTestIds.explicitPsdImportSelectedLayerNodeRef;
  selectedLayerLabel.append(selectedLayer);

  const selectedLayerRefsLabel = document.createElement("label");
  selectedLayerRefsLabel.className = "editor-field editor-field--wide";
  selectedLayerRefsLabel.textContent = "Initial selected PSD leaf layers";
  hideTechnicalField(selectedLayerRefsLabel);

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
      : options.destinationParts.map((part) => ({ value: part.partId, label: formatPartOptionLabel(part.label) })),
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
      ...options.destinationParts.map((part) => ({ value: part.partId, label: formatPartOptionLabel(part.label) }))
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
      : options.destinationParts.map((part) => ({ value: part.partId, label: formatPartOptionLabel(part.label) })),
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
      : options.destinationParts.map((part) => ({ value: part.partId, label: formatPartOptionLabel(part.label) })),
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
        ? `Select PSD leaf layer ${formatTreeRowName(row.label)} for batch`
        : `PSD group ${formatTreeRowName(row.label)} is not a leaf layer batch target`
    );
    batchChoice.addEventListener("change", syncBatchRefs);
    batchChoices.push(batchChoice);

    const label = document.createElement("span");
    label.className = "explicit-psd-import-tree__label";
    label.textContent = row.label;

    const meta = document.createElement("span");
    meta.className = "explicit-psd-import-tree__meta";
    meta.textContent = formatTreeRowHumanMeta(row);

    item.append(choice, batchChoice, label, meta);
    list.append(item);
  }

  syncBatchRefs();
  section.append(
    list,
    createHiddenTextList(
      "Parsed PSD layer technical rows",
      viewModel.treeRows.map((row) => `${row.nodeRef} / ${row.label} / ${row.metaLabel}`)
    )
  );
  return section;
};

const formatImportPlanCandidateHumanLabel = (
  row: ExplicitPsdImportViewModel["importPlanCandidateRows"][number]
): string => {
  const name = formatImportPlanCandidateName(row.label);
  const parent = findSegmentValue(row.label, "parent=") ?? "root";
  const visibility = findBareSegment(row.label, ["visible", "hidden"]) ?? "visibility unknown";
  const bounds = findSegmentValue(row.label, "bounds=") ?? "bounds unavailable";
  const approval = row.approved ? "approved" : row.approvalEligible ? "ready for review" : "not eligible";

  return [
    name,
    parent === "root" ? "root group" : `in ${parent}`,
    visibility,
    bounds,
    approval
  ].join(" / ");
};

const formatImportPlanCandidateName = (label: string): string =>
  findSegmentValue(label, "name=") ?? findHumanPathSegment(label) ?? "PSD leaf layer";

const formatStructuralScaffoldNodeHumanLabel = (
  row: ExplicitPsdImportViewModel["structuralScaffoldNodeRows"][number]
): string => {
  const name = formatStructuralScaffoldNodeName(row.label);
  const visibility = findBareSegment(row.label, ["visible", "hidden"]) ?? "visibility unknown";
  const bounds = findSegmentValue(row.label, "bounds=") ?? "bounds unavailable";
  const runtime = findSegmentValue(row.label, "runtime=") ?? "runtime pending";
  const approval = row.approved ? "approved" : row.approvalEligible ? "ready for review" : "not eligible";

  return [name, row.kind, visibility, bounds, runtime, approval].join(" / ");
};

const formatStructuralScaffoldNodeName = (label: string): string =>
  findHumanPathSegment(label, 2) ?? "PSD structure node";

const formatTreeRowName = (label: string): string =>
  label.split(" / ")[0]?.replace(/^(group|layer):\s*/i, "").trim() || "PSD node";

const formatTreeRowHumanMeta = (
  row: ExplicitPsdImportViewModel["treeRows"][number]
): string => {
  const segments = row.metaLabel.split(" / ").map((part) => part.trim()).filter((part) => part.length > 0);
  const visibility = segments.find((part) => part === "visible" || part === "hidden") ?? "visibility unknown";
  const opacity = segments.find((part) => part.startsWith("opacity ")) ?? "opacity unknown";
  const bounds = segments.find(isBoundsLikeLabel) ?? "bounds unavailable";
  const role = segments.find((part) => part === "group" || part === "editableLayer") ?? row.kind;
  const unsupported = segments.find((part) => part.startsWith("unsupported ")) === undefined
    ? "supported"
    : "needs review";

  return [visibility, opacity, bounds, role, unsupported].join(" / ");
};

const formatPsdScopeLabel = (scopeRef: string): string => {
  const normalized = scopeRef.trim();
  if (normalized.length === 0 || normalized === "psd:root") {
    return "Full PSD document";
  }

  return "Selected PSD structure";
};

const formatDestinationParentLabel = (
  destinationParts: ExplicitPsdImportPanelOptions["destinationParts"],
  destinationPartId: string
): string => {
  if (destinationPartId.trim().length === 0) {
    return "No destination parent selected";
  }

  const partLabel = destinationParts.find((part) => part.partId === destinationPartId)?.label;
  return partLabel === undefined ? "Selected destination part" : formatPartOptionLabel(partLabel);
};

const formatPartOptionLabel = (label: string): string =>
  label.split(" / ")[0]?.trim() || "Project part";

const formatImportPlanCandidateCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 4) {
    return "No preview candidates yet";
  }

  return `${counts[0]} total / ${counts[1]} eligible / ${counts[2]} approved / ${counts[3]} waiting`;
};

const formatImportPlanReviewCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 4) {
    return "No preview warnings yet";
  }

  return `${counts[0]} hidden / ${counts[1]} unsupported / ${counts[2]} collisions / ${counts[3]} byte blocked`;
};

const formatStructuralSourceCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 4) {
    return "No structure preview counts yet";
  }

  return `${counts[0]} groups / ${counts[1]} leaves / ${counts[2]} approved groups / ${counts[3]} approved leaves`;
};

const formatStructuralOutputCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 2) {
    return "No generated structure yet";
  }

  return `${counts[0]} part containers / ${counts[1]} drawables`;
};

const formatStructuralHiddenCounts = (value: string | undefined): string => {
  const counts = parseDelimitedCounts(value);
  if (counts.length < 2) {
    return "No hidden structure preview yet";
  }

  return `${counts[0]} hidden leaves / ${counts[1]} runtime-hidden drawables`;
};

const parseDelimitedCounts = (value: string | undefined): readonly string[] =>
  value?.split(" / ").map((part) => part.trim()).filter((part) => part.length > 0) ?? [];

const findFactValue = (
  facts: readonly {
    readonly label: string;
    readonly value: string;
  }[],
  label: string
): string | undefined =>
  facts.find((fact) => fact.label === label)?.value;

const findSegmentValue = (label: string, prefix: string): string | undefined =>
  label
    .split(" / ")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();

const findBareSegment = (
  label: string,
  candidates: readonly string[]
): string | undefined =>
  label
    .split(" / ")
    .map((part) => part.trim())
    .find((part) => candidates.includes(part));

const findHumanPathSegment = (label: string, preferredIndex = 1): string | undefined => {
  const segments = label.split(" / ").map((part) => part.trim()).filter((part) => part.length > 0);
  const segment = segments[preferredIndex] ?? segments.find((part) => !part.includes("=") && !looksLikeMachineRef(part));
  if (segment === undefined || looksLikeMachineRef(segment)) {
    return undefined;
  }

  return segment;
};

const looksLikeMachineRef = (value: string): boolean =>
  /^(?:psd:|layer_|group_|part_|draw_|tex_|mesh_|sha256:)/i.test(value);

const isBoundsLikeLabel = (value: string): boolean =>
  value === "bounds unavailable" ||
  /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?\s+\d+(?:\.\d+)?x\d+(?:\.\d+)?$/u.test(value);

const countHumanDiagnostics = (items: readonly string[]): number =>
  items.filter((item) => !isEmptyDiagnosticLabel(item)).length;

const isEmptyDiagnosticLabel = (item: string): boolean =>
  /^No .+diagnostics$/i.test(item.trim()) ||
  /^No .+entries$/i.test(item.trim()) ||
  /^No .+summary$/i.test(item.trim()) ||
  item.trim().toLowerCase() === "no psd parser diagnostics";

const createHiddenFactList = (
  label: string,
  facts: readonly {
    readonly label: string;
    readonly value: string;
  }[]
): HTMLElement => {
  const list = document.createElement("dl");
  list.className = "explicit-psd-import-technical-state";
  list.dataset.psdImportTechnicalState = "true";
  list.setAttribute("aria-label", label);
  hideTechnicalField(list);

  for (const fact of facts) {
    appendFact(list, fact.label, fact.value);
  }

  return list;
};

const createHiddenTextList = (
  label: string,
  items: readonly string[]
): HTMLElement => {
  const list = document.createElement("ul");
  list.className = "explicit-psd-import-technical-state";
  list.dataset.psdImportTechnicalState = "true";
  list.setAttribute("aria-label", label);
  hideTechnicalField(list);

  for (const item of items) {
    const row = document.createElement("li");
    row.textContent = item;
    row.style.overflowWrap = "anywhere";
    list.append(row);
  }

  return list;
};

const hideTechnicalField = (field: HTMLElement): void => {
  field.setAttribute("aria-hidden", "true");
  field.style.display = "none";
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
  return `PSD parse failed: ${message}`;
};

const formatIntakeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Selected layer import failed: ${message}`;
};

const formatBatchIntakeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Selected leaf import failed: ${message}`;
};

const formatImportPlanError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Leaf import preview failed: ${message}`;
};

const formatStructuralScaffoldError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Structure preview or commit failed: ${message}`;
};
