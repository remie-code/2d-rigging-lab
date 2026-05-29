import { editorTestIds, type GeneratedEvidenceSummaryState } from "../../editor-state/index.js";

export const createGeneratedEvidenceSummaryPanel = (
  summary: GeneratedEvidenceSummaryState
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "evidence-panel evidence-panel--generated";
  panel.dataset.testid = editorTestIds.generatedEvidenceSummary;
  panel.setAttribute("aria-labelledby", "generated-evidence-summary-title");

  const title = document.createElement("h2");
  title.id = "generated-evidence-summary-title";
  title.textContent = "Generated evidence";

  const overview = document.createElement("dl");
  overview.className = "evidence-panel__facts";
  appendFact(overview, "Runtime snapshots", String(summary.runtimeSnapshotIds.length));
  appendFact(
    overview,
    "Runtime state files",
    String(summary.runtimeStateArtifactPaths.length)
  );
  appendFact(
    overview,
    "Runtime sequence files",
    String(summary.runtimeStateSequenceArtifactPaths.length)
  );
  appendFact(overview, "Validation reports", String(summary.validationReportIds.length));
  appendFact(
    overview,
    "Validation report files",
    String(summary.validationReportArtifactPaths.length)
  );

  panel.append(title, overview);
  panel.append(createValueList("Runtime snapshot IDs", summary.runtimeSnapshotIds));
  panel.append(createValueList("Runtime state paths", summary.runtimeStateArtifactPaths));
  panel.append(
    createValueList("Runtime state sequence paths", summary.runtimeStateSequenceArtifactPaths)
  );
  panel.append(createValueList("Validation report IDs", summary.validationReportIds));
  panel.append(createValueList("Validation report paths", summary.validationReportArtifactPaths));

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

  const title = document.createElement("h3");
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
  list.className = "evidence-panel__list evidence-panel__list--paths";

  for (const value of values) {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  }

  section.append(list);
  return section;
};
