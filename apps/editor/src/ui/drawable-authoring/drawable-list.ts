import {
  createDrawableMoveDownTestId,
  createDrawableMoveUpTestId,
  createDrawableRowTestId,
  createDrawableVisibilityToggleTestId,
  editorTestIds,
  type DrawableLayerControlsViewModel,
  type DrawableLayerItemViewModel,
  type DrawableListItemViewModel
} from "../../editor-state/index.js";

export interface DrawableListOptions {
  readonly drawables: readonly DrawableListItemViewModel[];
  readonly layerControls: DrawableLayerControlsViewModel;
  readonly onToggleRuntimeVisibility: (drawableId: string) => void;
  readonly onMoveLayer: (drawableId: string, direction: "up" | "down") => void;
}

export const createDrawableList = (options: DrawableListOptions): HTMLElement => {
  const container = document.createElement("div");
  container.className = "drawable-list";
  container.dataset.testid = editorTestIds.drawableList;
  container.setAttribute("aria-label", "Drawable list");

  if (options.drawables.length === 0) {
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
  for (const label of ["Name", "ID", "Mesh", "Bounds", "Layer", "Visibility", "Move"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }
  header.append(headerRow);

  const body = document.createElement("tbody");
  const layersByDrawableId = new Map(
    options.layerControls.orderedDrawables.map((drawable) => [drawable.drawableId, drawable])
  );
  for (const drawable of options.drawables) {
    body.append(createDrawableRow(drawable, layersByDrawableId.get(drawable.drawableId) ?? null, options));
  }

  table.append(header, body);
  container.append(table);

  return container;
};

const createDrawableRow = (
  drawable: DrawableListItemViewModel,
  layer: DrawableLayerItemViewModel | null,
  options: DrawableListOptions
): HTMLTableRowElement => {
  const row = document.createElement("tr");
  row.dataset.testid = createDrawableRowTestId(drawable.drawableId);

  row.append(
    createCell("Name", drawable.displayName),
    createCell("ID", drawable.drawableId),
    createCell("Mesh", `${drawable.meshId} (${drawable.meshSummaryLabel})`),
    createCell("Bounds", drawable.boundsLabel),
    createCell("Layer", layer?.orderLabel ?? `${drawable.layerOrderLabel} / ${drawable.baseDrawOrderLabel}`),
    createVisibilityCell(drawable, layer, options.onToggleRuntimeVisibility),
    createMoveCell(drawable, layer, options.onMoveLayer)
  );

  return row;
};

const createCell = (label: string, value: string): HTMLTableCellElement => {
  const cell = document.createElement("td");
  cell.dataset.label = label;
  cell.textContent = value;

  return cell;
};

const createVisibilityCell = (
  drawable: DrawableListItemViewModel,
  layer: DrawableLayerItemViewModel | null,
  onToggleRuntimeVisibility: (drawableId: string) => void
): HTMLTableCellElement => {
  const cell = document.createElement("td");
  cell.dataset.label = "Visibility";
  cell.className = "drawable-list__visibility-cell";

  const state = document.createElement("span");
  state.className = "drawable-list__visibility-state";
  state.textContent = drawable.visibilityLabel;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "drawable-list__control drawable-list__control--visibility";
  toggle.dataset.testid = createDrawableVisibilityToggleTestId(drawable.drawableId);
  toggle.setAttribute("aria-label", layer?.visibilityToggleLabel ?? drawable.visibilityLabel);
  toggle.setAttribute("aria-pressed", drawable.visible ? "true" : "false");
  toggle.textContent = drawable.visible ? "Hide" : "Show";
  toggle.addEventListener("click", () => onToggleRuntimeVisibility(drawable.drawableId));

  cell.append(state, toggle);

  return cell;
};

const createMoveCell = (
  drawable: DrawableListItemViewModel,
  layer: DrawableLayerItemViewModel | null,
  onMoveLayer: (drawableId: string, direction: "up" | "down") => void
): HTMLTableCellElement => {
  const cell = document.createElement("td");
  cell.dataset.label = "Move";
  cell.className = "drawable-list__move-cell";

  const moveUp = createMoveButton({
    label: layer?.moveUpLabel ?? drawable.layerOrderLabel,
    text: "Up",
    testId: createDrawableMoveUpTestId(drawable.drawableId),
    disabled: !(layer?.canMoveUp ?? drawable.canMoveLayerUp),
    onClick: () => onMoveLayer(drawable.drawableId, "up")
  });
  const moveDown = createMoveButton({
    label: layer?.moveDownLabel ?? drawable.layerOrderLabel,
    text: "Down",
    testId: createDrawableMoveDownTestId(drawable.drawableId),
    disabled: !(layer?.canMoveDown ?? drawable.canMoveLayerDown),
    onClick: () => onMoveLayer(drawable.drawableId, "down")
  });

  cell.append(moveUp, moveDown);

  return cell;
};

const createMoveButton = (options: {
  readonly label: string;
  readonly text: string;
  readonly testId: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "drawable-list__control";
  button.dataset.testid = options.testId;
  button.disabled = options.disabled;
  button.setAttribute("aria-label", options.label);
  button.textContent = options.text;
  button.addEventListener("click", options.onClick);

  return button;
};
