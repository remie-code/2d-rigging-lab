import {
  createDrawableRowTestId,
  editorTestIds,
  type DrawableListItemViewModel
} from "../../editor-state/index.js";

export const createDrawableList = (
  drawables: readonly DrawableListItemViewModel[]
): HTMLElement => {
  const container = document.createElement("div");
  container.className = "drawable-list";
  container.dataset.testid = editorTestIds.drawableList;
  container.setAttribute("aria-label", "Drawable list");

  if (drawables.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "drawable-list__empty";
    emptyState.textContent = "No drawables yet.";
    container.append(emptyState);

    return container;
  }

  const table = document.createElement("table");
  table.className = "drawable-list__table";

  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["Name", "ID", "Mesh", "Bounds", "Draw order", "Visible"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }
  header.append(headerRow);

  const body = document.createElement("tbody");
  for (const drawable of drawables) {
    body.append(createDrawableRow(drawable));
  }

  table.append(header, body);
  container.append(table);

  return container;
};

const createDrawableRow = (drawable: DrawableListItemViewModel): HTMLTableRowElement => {
  const row = document.createElement("tr");
  row.dataset.testid = createDrawableRowTestId(drawable.drawableId);

  row.append(
    createCell("Name", drawable.displayName),
    createCell("ID", drawable.drawableId),
    createCell("Mesh", `${drawable.meshId} (${drawable.meshSummaryLabel})`),
    createCell("Bounds", drawable.boundsLabel),
    createCell("Draw order", drawable.baseDrawOrderLabel),
    createCell("Visible", drawable.visible ? "Yes" : "No")
  );

  return row;
};

const createCell = (label: string, value: string): HTMLTableCellElement => {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = value;

  return cell;
};
