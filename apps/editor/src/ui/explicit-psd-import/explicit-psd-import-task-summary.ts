import type { ExplicitPsdImportViewModel } from "../../editor-state/index.js";

export interface ExplicitPsdImportTaskSummaryOptions {
  readonly viewModel: ExplicitPsdImportViewModel;
  readonly destinationParts: readonly {
    readonly partId: string;
    readonly label: string;
  }[];
}

export const createExplicitPsdImportTaskSummary = (
  options: ExplicitPsdImportTaskSummaryOptions
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-task-summary";
  section.setAttribute("aria-label", "PSD import task human summary");

  const heading = document.createElement("h3");
  heading.textContent = "Import overview";

  const facts = document.createElement("dl");
  facts.className = "source-intake-summary explicit-psd-import-task-summary__facts";
  appendFact(facts, "Source", formatSourceSummary(options.viewModel));
  appendFact(facts, "File handling", formatSourceHandlingSummary(options.viewModel));
  appendFact(facts, "Parse state", options.viewModel.statusLabel);
  appendFact(facts, "Tree state", formatTreeSummary(options.viewModel));
  appendFact(facts, "Import scope", formatImportPlanScopeSummary(options));
  appendFact(facts, "Structural preview", formatStructuralPreviewSummary(options.viewModel));
  appendFact(facts, "Warning summary", formatWarningSummary(options.viewModel));
  appendFact(facts, "Approval and commit", formatApprovalCommitSummary(options.viewModel));
  appendFact(facts, "Cancel", "Close this task before importing to return without project changes.");
  appendFact(facts, "Next action", formatNextActionSummary(options));

  section.append(heading, facts);
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

const formatSourceHandlingSummary = (viewModel: ExplicitPsdImportViewModel): string => {
  const rawBytes = findFactValue(viewModel.sourceFacts, "Raw PSD bytes");
  if (rawBytes !== undefined) {
    return "Local PSD selected for this browser session; choose it again after project reload.";
  }

  return "Waiting for a user-selected local PSD file.";
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
  options: ExplicitPsdImportTaskSummaryOptions
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

const formatNextActionSummary = (
  options: ExplicitPsdImportTaskSummaryOptions
): string => {
  const viewModel = options.viewModel;
  if (viewModel.status === "idle") {
    return "Choose a PSD file and parse it.";
  }

  if (viewModel.status === "rejected" || viewModel.status === "failed") {
    return "Choose another PSD file or parse again after resolving the error.";
  }

  if (viewModel.structuralScaffoldApprovedNodeRefs.length > 0) {
    return "Commit the approved structural scaffold or adjust the approved nodes.";
  }

  if (viewModel.importPlanApprovedLayerNodeRefs.length > 0) {
    return "Add the approved leaf candidates or update the preview after changes.";
  }

  if (viewModel.importPlanCandidateRows.length > 0 || viewModel.structuralScaffoldNodeRows.length > 0) {
    return "Review warnings, choose eligible candidates or nodes, then update the preview.";
  }

  if (options.destinationParts.length === 0) {
    return "Create or load a destination part before committing imported content.";
  }

  return "Review the parsed tree, choose a scope, and generate a preview.";
};

const formatPsdScopeLabel = (scopeRef: string): string => {
  const normalized = scopeRef.trim();
  if (normalized.length === 0 || normalized === "psd:root") {
    return "root PSD scope";
  }

  return "selected PSD scope";
};

const formatDestinationParentLabel = (
  options: ExplicitPsdImportTaskSummaryOptions
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
