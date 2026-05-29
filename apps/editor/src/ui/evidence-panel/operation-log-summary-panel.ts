import { editorTestIds, type OperationLogSummaryState } from "../../editor-state/index.js";

export const createOperationLogSummaryPanel = (
  summary: OperationLogSummaryState
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "evidence-panel evidence-panel--operation-log";
  panel.dataset.testid = editorTestIds.operationLogSummary;
  panel.setAttribute("aria-labelledby", "operation-log-summary-title");

  const title = document.createElement("h2");
  title.id = "operation-log-summary-title";
  title.textContent = "Operation log";

  const overview = document.createElement("dl");
  overview.className = "evidence-panel__facts";
  appendFact(overview, "Entries", String(summary.entryCount));
  appendFact(
    overview,
    "Operation types",
    summary.operationTypes.length === 0 ? "None" : summary.operationTypes.join(", ")
  );

  panel.append(title, overview);

  if (summary.latestEntry === undefined) {
    const empty = document.createElement("p");
    empty.className = "evidence-panel__empty";
    empty.textContent = "No committed operations yet.";
    panel.append(empty);
    return panel;
  }

  const latest = document.createElement("article");
  latest.className = "evidence-panel__subsection";

  const latestTitle = document.createElement("h3");
  latestTitle.textContent = "Latest entry";

  const latestFacts = document.createElement("dl");
  latestFacts.className = "evidence-panel__facts";
  appendFact(latestFacts, "Operation ID", summary.latestEntry.operationId);
  appendFact(latestFacts, "Type", summary.latestEntry.operationType);
  appendFact(latestFacts, "Surface", summary.latestEntry.surface);
  appendFact(latestFacts, "Timestamp", summary.latestEntry.timestamp);

  latest.append(latestTitle, latestFacts);
  latest.append(createValueList("Target IDs", summary.latestEntry.targetIds));
  panel.append(latest);

  return panel;
};

const appendFact = (list: HTMLDListElement, label: string, value: string): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  list.append(term, description);
};

const createValueList = (label: string, values: readonly string[]): HTMLElement => {
  const section = document.createElement("section");
  section.className = "evidence-panel__subsection";

  const title = document.createElement("h4");
  title.textContent = label;
  section.append(title);

  if (values.length === 0) {
    const empty = document.createElement("p");
    empty.className = "evidence-panel__empty";
    empty.textContent = "None";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "evidence-panel__list";

  for (const value of values) {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  }

  section.append(list);
  return section;
};
