import type { LayerTreeViewModel } from "../../editor-state/index.js";
import {
  createDrawableList,
  type DrawableListOptions
} from "../drawable-authoring/drawable-list.js";
import { createLayerTreePanel, type LayerTreePanelOptions } from "../layer-tree/layer-tree-panel.js";
import { applyShellSurfaceMetadata, shellSurfaces } from "./shell-surfaces.js";

export interface PartsTreeSurfaceOptions {
  readonly layerTree: LayerTreePanelOptions;
  readonly drawableList?: DrawableListOptions;
}

export const createPartsTreeSurface = (options: PartsTreeSurfaceOptions): HTMLElement => {
  const surface = document.createElement("section");
  surface.className = "parts-tree-surface";
  surface.setAttribute("aria-labelledby", "editor-parts-tree-surface-heading");
  applyShellSurfaceMetadata(surface, shellSurfaces.authoringWorkspace, {
    group: "parts-tree"
  });

  const heading = document.createElement("h2");
  heading.id = "editor-parts-tree-surface-heading";
  heading.textContent = "Structure / Parts";

  surface.append(heading, createPartsTreeSummary(options.layerTree.viewModel));

  const layerTreePanel = createLayerTreePanel(options.layerTree);
  applyShellSurfaceMetadata(layerTreePanel, shellSurfaces.authoringWorkspace, {
    group: "parts-tree"
  });
  layerTreePanel.classList.add("parts-tree-surface__layer-tree");
  surface.append(layerTreePanel);

  if (options.drawableList !== undefined) {
    surface.append(createDrawableListSection(options.drawableList));
  }

  return surface;
};

const createPartsTreeSummary = (viewModel: LayerTreeViewModel): HTMLElement => {
  const summary = document.createElement("section");
  summary.className = "parts-tree-surface__summary";
  summary.setAttribute("role", "status");
  summary.setAttribute("aria-label", "Structure and parts row state summary");

  const overview = document.createElement("p");
  overview.className = "parts-tree-surface__summary-overview";
  overview.textContent = viewModel.summaryLabel;

  const list = document.createElement("ul");
  list.className = "parts-tree-surface__summary-list";
  for (const label of createStateSummaryLabels(viewModel)) {
    const item = document.createElement("li");
    item.textContent = label;
    list.append(item);
  }

  summary.append(overview, list);

  return summary;
};

const createStateSummaryLabels = (viewModel: LayerTreeViewModel): readonly string[] => [
  viewModel.partCountLabel,
  viewModel.drawableCountLabel,
  viewModel.selectedCountLabel,
  viewModel.lockedCountLabel,
  viewModel.editorHiddenCountLabel,
  viewModel.missingTextureCountLabel,
  viewModel.directManipulationDraftCountLabel
];

const createDrawableListSection = (options: DrawableListOptions): HTMLElement => {
  const section = document.createElement("section");
  section.className = "parts-tree-surface__drawable-list";
  section.setAttribute("aria-labelledby", "editor-parts-tree-draw-order-heading");

  const heading = document.createElement("h3");
  heading.id = "editor-parts-tree-draw-order-heading";
  heading.textContent = "Draw Order / Runtime Visibility";

  const meta = document.createElement("p");
  meta.className = "parts-tree-surface__draw-order-summary";
  meta.textContent = options.layerControls.layerCountLabel;

  section.append(heading, meta, createDrawableList(options));

  return section;
};
