import {
  createProductPreflightCategoryRowTestId,
  editorTestIds,
  type ProductPreflightComparisonState,
  type ProductPreflightState
} from "../../editor-state/index.js";
import { createProductPreflightComparisonSection } from "./product-preflight-comparison-section.js";

export interface ProductPreflightPanelOptions {
  readonly state: ProductPreflightState;
  readonly comparisonState?: ProductPreflightComparisonState;
  readonly isPackageLoaded: boolean;
  readonly currentPackageRevision: number;
  readonly onRunProductPreflight?: () => void | Promise<void>;
}

export const createProductPreflightPanel = (
  options: ProductPreflightPanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "product-preflight-panel";
  panel.dataset.testid = editorTestIds.productPreflightPanel;
  panel.setAttribute("aria-labelledby", "product-preflight-heading");

  const heading = document.createElement("h2");
  heading.id = "product-preflight-heading";
  heading.textContent = "Product Preflight";

  panel.append(
    heading,
    createProductPreflightActions(options),
    createProductPreflightStatus(options)
  );

  if (options.state.status === "ready") {
    panel.append(
      createProductPreflightSummary(options.state),
      createCategorySummary(options.state),
      createBlockingIssues(options.state),
      createWarnings(options.state),
      createUnsupportedClaims(options.state),
      createNotEvaluatedClaims(options.state),
      ...(options.comparisonState === undefined
        ? []
        : [createProductPreflightComparisonSection(options.comparisonState)])
    );
  }

  return panel;
};

const createProductPreflightActions = (
  options: ProductPreflightPanelOptions
): HTMLElement => {
  const actions = document.createElement("div");
  actions.className = "product-preflight-panel__actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-button editor-button--primary product-preflight-panel__run";
  button.dataset.testid = editorTestIds.productPreflightRun;
  button.disabled = !options.isPackageLoaded || options.onRunProductPreflight === undefined;
  button.textContent = "Run preflight";
  button.addEventListener("click", () => {
    void options.onRunProductPreflight?.();
  });

  actions.append(button);
  return actions;
};

const createProductPreflightStatus = (
  options: ProductPreflightPanelOptions
): HTMLElement => {
  const status = document.createElement("div");
  status.className = `product-preflight-panel__status product-preflight-panel__status--${options.state.status}`;
  status.dataset.testid = editorTestIds.productPreflightStatus;
  status.setAttribute("role", "status");

  const label = document.createElement("p");
  label.className = "product-preflight-panel__status-label";
  label.textContent = createStatusLabel(options);

  const detail = document.createElement("p");
  detail.className = "product-preflight-panel__status-detail";
  detail.textContent = createStatusDetail(options);

  status.append(label, detail);
  return status;
};

const createStatusLabel = (options: ProductPreflightPanelOptions): string => {
  switch (options.state.status) {
    case "not_run":
      return "Not run";
    case "failed":
      return "Preflight failed";
    case "ready":
      return `${options.state.overallStatus} / ${options.state.highestSeverity}`;
  }
};

const createStatusDetail = (options: ProductPreflightPanelOptions): string => {
  const state = options.state;

  if (state.status === "not_run") {
    return "No product preflight report has run in this editor session.";
  }

  if (state.status === "failed") {
    return state.errorMessage ?? "Product preflight failed without a detailed message.";
  }

  const currentRevision = options.currentPackageRevision;
  const revisionLabel =
    state.packageRevision === currentRevision
      ? `r${state.packageRevision}`
      : `report r${state.packageRevision}; current r${currentRevision}`;

  return `${state.reportId} for ${state.packageId} ${revisionLabel}; created ${state.createdAt}.`;
};

const createProductPreflightSummary = (
  state: ProductPreflightState
): HTMLElement => {
  const summary = document.createElement("dl");
  summary.className = "product-preflight-panel__facts";
  summary.dataset.testid = editorTestIds.productPreflightSummary;

  appendFact(summary, "pass", String(state.categoryCounts.pass));
  appendFact(summary, "warn", String(state.categoryCounts.warn));
  appendFact(summary, "fail", String(state.categoryCounts.fail));
  appendFact(summary, "not_supported", String(state.categoryCounts.not_supported));
  appendFact(summary, "not_evaluated", String(state.categoryCounts.not_evaluated));
  appendFact(summary, "blocking issues", String(state.blockingReasonCount));
  appendFact(summary, "warnings", String(state.warnings.length));
  appendFact(summary, "evidence refs", String(state.evidenceRefCount));
  appendFact(summary, "diagnostic refs", String(state.diagnosticRefCount));

  return summary;
};

const createCategorySummary = (
  state: ProductPreflightState
): HTMLElement => {
  const section = createReportSection(
    "Category summary",
    editorTestIds.productPreflightCategorySummary
  );
  const list = document.createElement("ul");
  list.className = "product-preflight-panel__category-list";

  for (const category of state.categories) {
    const item = document.createElement("li");
    item.className = `product-preflight-panel__category product-preflight-panel__category--${category.status}`;
    item.dataset.testid = createProductPreflightCategoryRowTestId(category.category);

    const title = document.createElement("p");
    title.className = "product-preflight-panel__item-title";
    title.textContent = `${category.category}: ${category.status} / ${category.severity}`;

    const summary = document.createElement("p");
    summary.className = "product-preflight-panel__item-detail";
    summary.textContent = category.summary;

    const counts = document.createElement("p");
    counts.className = "product-preflight-panel__item-meta";
    counts.textContent = [
      `${category.evidenceRefCount} evidence`,
      `${category.diagnosticRefCount} diagnostics`,
      `${category.blockingReasonCount} blocking`,
      `${category.unsupportedClaimCount} not_supported`,
      `${category.notEvaluatedClaimCount} not_evaluated`
    ].join(" / ");

    item.append(title, summary, counts);
    list.append(item);
  }

  section.append(list);
  return section;
};

const createBlockingIssues = (
  state: ProductPreflightState
): HTMLElement => {
  const section = createReportSection(
    "Blocking issues",
    editorTestIds.productPreflightBlockingIssues
  );

  if (state.blockingIssues.length === 0) {
    section.append(createEmptyMessage("No blocking issues in the latest product preflight report."));
    return section;
  }

  section.append(createIssueList(state.blockingIssues.map((issue) => ({
    title: `${issue.category}: ${issue.reasonCode} / ${issue.severity}`,
    detail: issue.message,
    meta: issue.diagnosticLabel
  }))));
  return section;
};

const createWarnings = (
  state: ProductPreflightState
): HTMLElement => {
  const section = createReportSection("Warnings", editorTestIds.productPreflightWarnings);

  if (state.warnings.length === 0) {
    section.append(createEmptyMessage("No warn categories in the latest product preflight report."));
    return section;
  }

  section.append(createIssueList(state.warnings.map((warning) => ({
    title: `${warning.category}: ${warning.status} / ${warning.severity}`,
    detail: warning.message,
    meta: warning.diagnosticLabel
  }))));
  return section;
};

const createUnsupportedClaims = (
  state: ProductPreflightState
): HTMLElement => {
  const section = createReportSection(
    "Not supported",
    editorTestIds.productPreflightUnsupportedClaims
  );

  if (state.unsupportedClaims.length === 0) {
    section.append(createEmptyMessage("No not_supported claims in the latest product preflight report."));
    return section;
  }

  section.append(createIssueList(state.unsupportedClaims.map((claim) => ({
    title: `${claim.category}: ${claim.claimKind} / ${claim.severity}`,
    detail: `${claim.capabilityLabel}: ${claim.explanation}`,
    meta: claim.claimId
  }))));
  return section;
};

const createNotEvaluatedClaims = (
  state: ProductPreflightState
): HTMLElement => {
  const section = createReportSection(
    "Not evaluated",
    editorTestIds.productPreflightNotEvaluated
  );

  if (state.notEvaluatedClaims.length === 0) {
    section.append(createEmptyMessage("No not_evaluated claims in the latest product preflight report."));
    return section;
  }

  section.append(createIssueList(state.notEvaluatedClaims.map((claim) => ({
    title: `${claim.category}: ${claim.evidenceKind} / ${claim.severity}`,
    detail: claim.reason,
    meta: `required: ${claim.requiredEvidenceLabel}`
  }))));
  return section;
};

const createReportSection = (
  titleText: string,
  testId: string
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "product-preflight-panel__section";
  section.dataset.testid = testId;

  const title = document.createElement("h3");
  title.textContent = titleText;

  section.append(title);
  return section;
};

const createIssueList = (
  rows: readonly {
    readonly title: string;
    readonly detail: string;
    readonly meta: string;
  }[]
): HTMLElement => {
  const list = document.createElement("ul");
  list.className = "product-preflight-panel__issue-list";

  for (const row of rows) {
    const item = document.createElement("li");
    item.className = "product-preflight-panel__issue";

    const title = document.createElement("p");
    title.className = "product-preflight-panel__item-title";
    title.textContent = row.title;

    const detail = document.createElement("p");
    detail.className = "product-preflight-panel__item-detail";
    detail.textContent = row.detail;

    const meta = document.createElement("p");
    meta.className = "product-preflight-panel__item-meta";
    meta.textContent = row.meta;

    item.append(title, detail, meta);
    list.append(item);
  }

  return list;
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

  list.append(term, description);
};

const createEmptyMessage = (message: string): HTMLParagraphElement => {
  const empty = document.createElement("p");
  empty.className = "product-preflight-panel__empty";
  empty.textContent = message;

  return empty;
};
