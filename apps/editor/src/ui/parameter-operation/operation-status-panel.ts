import {
  editorTestIds,
  type EditorDiagnosticSummary,
  type EditorSemanticState,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";

export const createOperationStatusPanel = (
  state: EditorSemanticState,
  viewModel: EditorWorkflowViewModel
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "operation-status";
  panel.dataset.testid = editorTestIds.operationStatus;
  panel.setAttribute("aria-label", "Operation status");

  const heading = document.createElement("h3");
  heading.textContent = "Operation Status";

  const status = document.createElement("p");
  status.className = `operation-status__badge operation-status__badge--${state.pendingCreateParameter.status}`;
  status.textContent = viewModel.lastOperationLabel;

  const log = document.createElement("p");
  log.className = "operation-status__meta";
  log.textContent = `${viewModel.operationLogLabel} | ${viewModel.reloadLabel}`;

  panel.append(heading, status, log, createDiagnosticsList(state.pendingCreateParameter.diagnostics));

  return panel;
};

const createDiagnosticsList = (diagnostics: readonly EditorDiagnosticSummary[]): HTMLElement => {
  const container = document.createElement("div");
  container.className = "operation-status__diagnostics";

  const heading = document.createElement("p");
  heading.className = "operation-status__diagnostics-heading";
  heading.textContent = "Diagnostics";
  container.append(heading);

  if (diagnostics.length === 0) {
    const empty = document.createElement("p");
    empty.className = "operation-status__empty";
    empty.textContent = "No diagnostics.";
    container.append(empty);

    return container;
  }

  const list = document.createElement("ul");
  for (const diagnostic of diagnostics) {
    const item = document.createElement("li");
    item.textContent = `[${diagnostic.severity}] ${diagnostic.checkId}: ${diagnostic.message}`;
    list.append(item);
  }
  container.append(list);

  return container;
};
