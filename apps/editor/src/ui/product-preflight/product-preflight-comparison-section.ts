import {
  editorTestIds,
  type ProductPreflightComparisonDiffState,
  type ProductPreflightComparisonRefChangeState,
  type ProductPreflightComparisonState,
  type ProductPreflightComparisonTransitionState
} from "../../editor-state/index.js";

export const createProductPreflightComparisonSection = (
  state: ProductPreflightComparisonState
): HTMLElement => {
  const section = createReportSection(
    "Deterministic report comparison",
    editorTestIds.productPreflightComparison
  );

  if (state.status === "failed") {
    section.append(createEmptyMessage(state.errorMessage ?? state.summaryLabel));
    return section;
  }

  if (state.status === "not_available") {
    section.append(createEmptyMessage(state.summaryLabel));
    return section;
  }

  section.append(
    createFacts([
      ["generated", state.generatedAt ?? "not generated"],
      ["summary", state.summaryLabel],
      ["scope", state.safetyLabel]
    ]),
    createReportSlots(state),
    createDiffSummary(state.comparisons),
    createCategoryTransitions(state.comparisons),
    createReferenceChanges(state.comparisons),
    createRerunAffordance(state)
  );

  return section;
};

const createReportSlots = (state: ProductPreflightComparisonState): HTMLElement =>
  createIssueList(state.reportSlots.map((slot) => ({
    title: `${slot.label}: ${slot.reportIdLabel}`,
    detail: slot.statusLabel,
    meta: slot.available ? `${slot.packageLabel} / ${slot.refCountLabel}` : "not available"
  })));

const createDiffSummary = (
  comparisons: readonly ProductPreflightComparisonDiffState[]
): HTMLElement => {
  const section = createReportSection(
    "Diff summary",
    editorTestIds.productPreflightComparisonSummary
  );

  if (comparisons.length === 0) {
    section.append(createEmptyMessage(
      "No previous or proposal-preview report is available for deterministic report comparison."
    ));
    return section;
  }

  section.append(createIssueList(comparisons.map((comparison) => ({
    title: `${comparison.title}: ${comparison.reportLabel}`,
    detail: `${comparison.statusTransitionLabel}; ${comparison.severityTransitionLabel}`,
    meta: comparison.changeCountLabel
  }))));
  return section;
};

const createCategoryTransitions = (
  comparisons: readonly ProductPreflightComparisonDiffState[]
): HTMLElement => {
  const section = createReportSection(
    "Category transitions",
    editorTestIds.productPreflightComparisonTransitions
  );
  const rows = comparisons.flatMap((comparison) =>
    comparison.categoryTransitions.map((transition) =>
      projectTransitionRow(comparison, transition)
    )
  );

  if (rows.length === 0) {
    section.append(createEmptyMessage("No category transitions are available."));
    return section;
  }

  section.append(createIssueList(rows));
  return section;
};

const createReferenceChanges = (
  comparisons: readonly ProductPreflightComparisonDiffState[]
): HTMLElement => {
  const section = createReportSection(
    "Evidence and diagnostic refs",
    editorTestIds.productPreflightComparisonRefs
  );
  const rows = comparisons.flatMap((comparison) => [
    ...comparison.evidenceRefChanges.map((change) =>
      projectRefChangeRow(comparison, "Evidence", change)
    ),
    ...comparison.diagnosticRefChanges.map((change) =>
      projectRefChangeRow(comparison, "Diagnostic", change)
    )
  ]);

  if (rows.length === 0) {
    section.append(createEmptyMessage("No evidence or diagnostic ref changes."));
    return section;
  }

  section.append(createIssueList(rows));
  return section;
};

const createRerunAffordance = (
  state: ProductPreflightComparisonState
): HTMLElement => {
  const section = createReportSection(
    "Rerun affordance",
    editorTestIds.productPreflightComparisonRerun
  );

  if (state.rerunAffordances.length === 0) {
    section.append(createEmptyMessage("No Product Preflight rerun affordance is available."));
    return section;
  }

  section.append(createIssueList(state.rerunAffordances.map((affordance) => ({
    title: `${affordance.label}: ${affordance.sourceReportId}`,
    detail: affordance.statusLabel,
    meta: `${affordance.triggerLabel} / ${affordance.safetyLabel}`
  }))));
  return section;
};

const projectTransitionRow = (
  comparison: ProductPreflightComparisonDiffState,
  transition: ProductPreflightComparisonTransitionState
) => ({
  title: `${comparison.title}: ${transition.category}`,
  detail: `${transition.statusLabel}; ${transition.severityLabel}`,
  meta: transition.changedLabel
});

const projectRefChangeRow = (
  comparison: ProductPreflightComparisonDiffState,
  kind: "Evidence" | "Diagnostic",
  change: ProductPreflightComparisonRefChangeState
) => ({
  title: `${comparison.title}: ${kind} ${change.title}`,
  detail: change.detail,
  meta: change.meta
});

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

const createFacts = (
  rows: readonly (readonly [string, string])[]
): HTMLDListElement => {
  const facts = document.createElement("dl");
  facts.className = "product-preflight-panel__facts";

  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    facts.append(term, description);
  }

  return facts;
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

const createEmptyMessage = (message: string): HTMLParagraphElement => {
  const empty = document.createElement("p");
  empty.className = "product-preflight-panel__empty";
  empty.textContent = message;
  return empty;
};
