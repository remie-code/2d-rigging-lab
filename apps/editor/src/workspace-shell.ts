import {
  appBarActions,
  inspectorFields,
  parameterTicks,
  statusItems,
  structureRows,
  toolboxSections,
  type StructureRow,
  type ToolboxEntry,
  type ToolboxSection,
} from "./workspace-content";

export function createAuthoringWorkspace(): HTMLElement {
  const workspace = document.createElement("main");
  workspace.className = "workspace-shell";
  workspace.setAttribute("aria-labelledby", "workspace-title");

  workspace.append(
    createAppBar(),
    createToolbox(),
    createStructureTree(),
    createCanvasPreview(),
    createInspector(),
    createParameterBar(),
    createStatusArea(),
  );

  return workspace;
}

function createAppBar(): HTMLElement {
  const appBar = document.createElement("header");
  appBar.className = "app-bar";

  const brand = document.createElement("div");
  brand.className = "app-brand";

  const mark = document.createElement("span");
  mark.className = "app-brand-mark";
  mark.setAttribute("aria-hidden", "true");

  const titleBlock = document.createElement("div");
  titleBlock.className = "app-title-block";

  const title = document.createElement("h1");
  title.id = "workspace-title";
  title.textContent = "Authoring Workspace";

  const subtitle = document.createElement("p");
  subtitle.textContent = "No project loaded";

  titleBlock.append(title, subtitle);
  brand.append(mark, titleBlock);

  const projectState = document.createElement("div");
  projectState.className = "app-project-state";
  projectState.setAttribute("aria-label", "Project status");

  for (const [label, value] of [
    ["Project", "Empty"],
    ["Mode", "Authoring"],
  ] as const) {
    const item = document.createElement("span");
    item.className = "app-state-pill";
    item.textContent = `${label}: ${value}`;
    projectState.append(item);
  }

  const actions = document.createElement("nav");
  actions.className = "app-actions";
  actions.setAttribute("aria-label", "Workspace actions");

  for (const action of appBarActions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "app-action";
    button.textContent = action;
    button.setAttribute("aria-disabled", "true");
    actions.append(button);
  }

  appBar.append(brand, projectState, actions);
  return appBar;
}

function createToolbox(): HTMLElement {
  const toolbox = document.createElement("aside");
  toolbox.className = "toolbox";
  toolbox.setAttribute("aria-label", "Toolbox");

  const heading = document.createElement("h2");
  heading.textContent = "Toolbox";
  toolbox.append(heading);

  for (const section of toolboxSections) {
    toolbox.append(createToolboxSection(section));
  }

  return toolbox;
}

function createToolboxSection(section: ToolboxSection): HTMLElement {
  const group = document.createElement("section");
  group.className = "toolbox-section";

  const label = document.createElement("h3");
  label.textContent = section.label;
  group.append(label);

  const list = document.createElement("div");
  list.className = "toolbox-list";

  for (const entry of section.entries) {
    list.append(createToolboxEntry(entry));
  }

  group.append(list);
  return group;
}

function createToolboxEntry(entry: ToolboxEntry): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "toolbox-entry";
  button.dataset.kind = entry.kind;
  button.setAttribute("aria-pressed", entry.state === "active" ? "true" : "false");

  if (entry.state === "planned") {
    button.setAttribute("aria-disabled", "true");
  }

  const label = document.createElement("span");
  label.className = "toolbox-entry-label";
  label.textContent = entry.label;

  const target = document.createElement("span");
  target.className = "toolbox-entry-target";
  target.textContent = entry.target;

  button.append(label, target);
  return button;
}

function createStructureTree(): HTMLElement {
  const panel = createPanel("structure-panel", "Structure / Parts");

  const hint = document.createElement("p");
  hint.className = "panel-hint";
  hint.textContent = "Parts, drawables, and hidden items will be organized here.";

  const tree = document.createElement("ol");
  tree.className = "structure-tree";

  for (const row of structureRows) {
    tree.append(createStructureRow(row));
  }

  panel.append(hint, tree);
  return panel;
}

function createStructureRow(row: StructureRow): HTMLLIElement {
  const item = document.createElement("li");
  item.className = row.tone === "muted" ? "structure-row is-muted" : "structure-row";

  const name = document.createElement("span");
  name.className = "structure-name";
  name.textContent = row.name;

  const detail = document.createElement("span");
  detail.className = "structure-detail";
  detail.textContent = row.detail;

  item.append(name, detail);
  return item;
}

function createCanvasPreview(): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "canvas-panel";
  panel.setAttribute("aria-labelledby", "canvas-title");

  const header = document.createElement("div");
  header.className = "panel-header";

  const title = document.createElement("h2");
  title.id = "canvas-title";
  title.textContent = "Canvas / Preview";

  const mode = document.createElement("span");
  mode.className = "panel-chip";
  mode.textContent = "Authoring";

  header.append(title, mode);

  const viewport = document.createElement("div");
  viewport.className = "preview-viewport";

  const frame = document.createElement("div");
  frame.className = "preview-frame";

  const center = document.createElement("div");
  center.className = "preview-center";
  center.textContent = "No artwork loaded";

  frame.append(center);

  const emptyState = document.createElement("div");
  emptyState.className = "canvas-empty-state";

  const emptyTitle = document.createElement("h3");
  emptyTitle.textContent = "Start with a PSD or project file";

  const emptyText = document.createElement("p");
  emptyText.textContent =
    "The preview area will show artwork, mesh overlays, rig poses, and viewer checks.";

  const entryRow = document.createElement("div");
  entryRow.className = "canvas-entry-row";

  for (const entry of ["PSD Import", "Open Project", "Viewer"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "canvas-entry";
    button.textContent = entry;
    button.setAttribute("aria-disabled", "true");
    entryRow.append(button);
  }

  emptyState.append(emptyTitle, emptyText, entryRow);
  viewport.append(frame, emptyState);
  panel.append(header, viewport);

  return panel;
}

function createInspector(): HTMLElement {
  const panel = createPanel("inspector-panel", "Inspector");

  const hint = document.createElement("p");
  hint.className = "panel-hint";
  hint.textContent =
    "Selection details, visibility, mesh state, and atlas state will appear here.";

  const fieldList = document.createElement("dl");
  fieldList.className = "inspector-fields";

  for (const [label, value] of inspectorFields) {
    const field = document.createElement("div");
    field.className = "inspector-field";

    const term = document.createElement("dt");
    term.textContent = label;

    const description = document.createElement("dd");
    description.textContent = value;

    field.append(term, description);
    fieldList.append(field);
  }

  const taskEntrypoints = document.createElement("section");
  taskEntrypoints.className = "inspector-entrypoints";

  const entryTitle = document.createElement("h3");
  entryTitle.textContent = "Task and View Entries";

  const entryText = document.createElement("p");
  entryText.textContent =
    "Toolbox tasks open in the workspace; Viewer opens as a dedicated view.";

  taskEntrypoints.append(entryTitle, entryText);
  panel.append(hint, fieldList, taskEntrypoints);

  return panel;
}

function createParameterBar(): HTMLElement {
  const bar = document.createElement("section");
  bar.className = "parameter-bar";
  bar.setAttribute("aria-labelledby", "parameter-title");

  const heading = document.createElement("div");
  heading.className = "parameter-heading";

  const title = document.createElement("h2");
  title.id = "parameter-title";
  title.textContent = "Parameter Bar";

  const active = document.createElement("span");
  active.className = "parameter-active";
  active.textContent = "No active parameter";

  heading.append(title, active);

  const track = document.createElement("div");
  track.className = "parameter-track";
  track.setAttribute("aria-hidden", "true");

  const fill = document.createElement("span");
  fill.className = "parameter-track-fill";
  track.append(fill);

  const ticks = document.createElement("div");
  ticks.className = "parameter-ticks";

  for (const tick of parameterTicks) {
    const tickItem = document.createElement("span");
    tickItem.textContent = tick;
    ticks.append(tickItem);
  }

  bar.append(heading, track, ticks);
  return bar;
}

function createStatusArea(): HTMLElement {
  const status = document.createElement("footer");
  status.className = "status-area";
  status.setAttribute("aria-label", "Workspace status");

  for (const item of statusItems) {
    const statusItem = document.createElement("span");
    statusItem.textContent = item;
    status.append(statusItem);
  }

  return status;
}

function createPanel(className: string, titleText: string): HTMLElement {
  const panel = document.createElement("section");
  panel.className = `workspace-panel ${className}`;
  panel.setAttribute("aria-labelledby", `${className}-title`);

  const header = document.createElement("div");
  header.className = "panel-header";

  const title = document.createElement("h2");
  title.id = `${className}-title`;
  title.textContent = titleText;

  header.append(title);
  panel.append(header);

  return panel;
}
