import {
  createProjectPersistenceTransportCapabilityRowTestId,
  createProjectPersistenceTransportUnavailableActionTestId,
  editorTestIds,
  type ProjectTransportCapabilityViewRow
} from "../../editor-state/index.js";

export const createProjectTransportCapabilitySection = (
  rows: readonly ProjectTransportCapabilityViewRow[]
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "project-persistence-panel__transport-capabilities";
  section.setAttribute("aria-labelledby", "project-transport-capability-heading");

  const heading = document.createElement("h3");
  heading.id = "project-transport-capability-heading";
  heading.textContent = "Transport capabilities";

  const list = document.createElement("ul");
  list.className = "project-persistence-panel__transport-capability-list";
  list.dataset.testid = editorTestIds.projectPersistenceTransportCapabilityList;

  for (const row of rows) {
    list.append(createTransportCapabilityRow(row));
  }

  section.append(heading, list);
  return section;
};

const createTransportCapabilityRow = (
  row: ProjectTransportCapabilityViewRow
): HTMLLIElement => {
  const item = document.createElement("li");
  item.className =
    `project-persistence-panel__transport-capability-row project-persistence-panel__transport-capability-row--${row.status}`;
  item.dataset.testid = createProjectPersistenceTransportCapabilityRowTestId(row.capabilityId);
  item.dataset.capabilityId = row.capabilityId;
  item.dataset.capabilityStatus = row.status;

  const title = document.createElement("strong");
  title.className = "project-persistence-panel__transport-capability-title";
  title.textContent = row.label;

  const status = document.createElement("span");
  status.className = "project-persistence-panel__transport-capability-status";
  status.textContent = `${row.statusLabel} / ${row.availabilityLabel}`;

  const summary = document.createElement("p");
  summary.className = "project-persistence-panel__transport-capability-summary";
  summary.textContent = `${row.transportKindLabel}: ${row.summary}`;

  const gates = document.createElement("p");
  gates.className = "project-persistence-panel__transport-capability-detail";
  gates.textContent = formatTransportCapabilityDetail("Gates", row.gateSummaries);

  const issues = document.createElement("p");
  issues.className = "project-persistence-panel__transport-capability-detail";
  issues.textContent = formatTransportCapabilityDetail("Issues", row.issueSummaries);

  item.append(title, status, summary, gates, issues);

  if (row.unavailableActionLabel !== null) {
    item.append(createUnavailableTransportAction(row));
  }

  return item;
};

const createUnavailableTransportAction = (
  row: ProjectTransportCapabilityViewRow
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-button project-persistence-panel__button";
  button.dataset.testid = createProjectPersistenceTransportUnavailableActionTestId(row.capabilityId);
  button.disabled = true;
  button.textContent = row.unavailableActionLabel;
  button.title = `${row.label}: ${row.statusLabel}`;

  return button;
};

const formatTransportCapabilityDetail = (
  label: string,
  values: readonly string[]
): string => `${label}: ${values.length === 0 ? "none" : values.join(" | ")}`;
