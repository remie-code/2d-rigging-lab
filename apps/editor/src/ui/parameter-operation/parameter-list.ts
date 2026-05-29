import {
  createParameterRowTestId,
  editorTestIds,
  type ParameterListItemState
} from "../../editor-state/index.js";

export const createParameterList = (parameters: readonly ParameterListItemState[]): HTMLElement => {
  const container = document.createElement("div");
  container.className = "parameter-list";
  container.dataset.testid = editorTestIds.parameterList;

  if (parameters.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "parameter-list__empty";
    emptyState.textContent = "No parameters yet.";
    container.append(emptyState);

    return container;
  }

  const table = document.createElement("table");
  table.className = "parameter-list__table";

  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["Name", "ID", "Range", "Default", "Step"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }
  header.append(headerRow);

  const body = document.createElement("tbody");
  for (const parameter of parameters) {
    body.append(createParameterRow(parameter));
  }

  table.append(header, body);
  container.append(table);

  return container;
};

const createParameterRow = (parameter: ParameterListItemState): HTMLTableRowElement => {
  const row = document.createElement("tr");
  row.dataset.testid = createParameterRowTestId(parameter.parameterId);

  row.append(
    createCell("Name", parameter.displayName),
    createCell("ID", parameter.parameterId),
    createCell("Range", `${formatNumber(parameter.min)} to ${formatNumber(parameter.max)}`),
    createCell("Default", formatNumber(parameter.defaultValue)),
    createCell("Step", formatNumber(parameter.recommendedUiStep))
  );

  return row;
};

const createCell = (label: string, value: string): HTMLTableCellElement => {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = value;

  return cell;
};

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
