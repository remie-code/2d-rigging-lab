import { editorTestIds, type ReloadSummaryState } from "../../editor-state/index.js";

export const createReloadSummaryPanel = (summary: ReloadSummaryState): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "package-file-set-panel package-file-set-panel--reload";
  panel.dataset.testid = editorTestIds.reloadSummary;
  panel.setAttribute("aria-labelledby", "reload-summary-title");

  const title = document.createElement("h2");
  title.id = "reload-summary-title";
  title.textContent = "Reload summary";

  const overview = document.createElement("dl");
  overview.className = "package-file-set-panel__facts";
  appendFact(overview, "Status", summary.status);
  appendFact(overview, "Package revision", String(summary.packageRevision));
  appendFact(overview, "Parameters after reload", String(summary.parameterCount));
  appendFact(overview, "Files observed", String(summary.filePaths.length));

  panel.append(title, overview);
  panel.append(createValueList("Committed parameter IDs", summary.parameterIds));
  panel.append(createValueList("Reloaded file paths", summary.filePaths));

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
  section.className = "package-file-set-panel__paths";

  const title = document.createElement("h3");
  title.textContent = label;
  section.append(title);

  if (values.length === 0) {
    const empty = document.createElement("p");
    empty.className = "package-file-set-panel__empty";
    empty.textContent = "None";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "package-file-set-panel__list";

  for (const value of values) {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  }

  section.append(list);
  return section;
};
