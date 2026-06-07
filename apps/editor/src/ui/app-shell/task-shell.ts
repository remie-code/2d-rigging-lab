import {
  applyShellSurfaceMetadata,
  type ShellSurfaceDefinition,
  type ShellSurfaceMetadataOptions
} from "./shell-surfaces.js";

export type TaskShellSlot = HTMLElement | readonly HTMLElement[] | null | undefined;

export interface TaskShellAffordanceOptions {
  readonly ariaLabel: string;
  readonly label?: string;
  readonly title?: string;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly onClick?: () => void | Promise<void>;
}

export type TaskShellState = "ready" | "loading" | "error" | "disabled";

export interface TaskShellOptions {
  readonly surface: ShellSurfaceDefinition;
  readonly surfaceMetadata?: ShellSurfaceMetadataOptions;
  readonly title: string;
  readonly status: string;
  readonly state?: TaskShellState;
  readonly stateMessage?: string;
  readonly titleId?: string;
  readonly statusId?: string;
  readonly back?: TaskShellAffordanceOptions | null;
  readonly close?: TaskShellAffordanceOptions | null;
  readonly primaryAction?: TaskShellSlot;
  readonly secondaryAction?: TaskShellSlot;
  readonly actionStatus?: TaskShellSlot;
  readonly diagnosticsSummary?: TaskShellSlot;
  readonly content?: TaskShellSlot;
}

export const createTaskShell = (options: TaskShellOptions): HTMLElement => {
  const shell = document.createElement("section");
  const state = options.state ?? "ready";
  shell.className = [
    "editor-task-shell",
    "editor-task-shell--window",
    `editor-task-shell--state-${state}`,
    "task-shell",
    "task-shell--workspace-window",
    `task-shell--${options.surface.kind}`,
    `task-shell--state-${state}`
  ].join(" ");
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "false");
  shell.setAttribute("aria-labelledby", resolveTaskShellTitleId(options));
  shell.setAttribute("aria-describedby", resolveTaskShellStatusId(options));
  shell.setAttribute("tabindex", "-1");
  shell.tabIndex = -1;
  shell.dataset.taskWindowScope = "workspace";
  shell.dataset.taskWindowState = state;
  if (state === "loading") {
    shell.setAttribute("aria-busy", "true");
  }
  if (state === "disabled") {
    shell.setAttribute("aria-disabled", "true");
  }
  assignTaskShellRegion(shell, "root", "window");
  applyShellSurfaceMetadata(shell, options.surface, options.surfaceMetadata);
  installTaskShellKeyboardAffordances(shell, options);

  const header = document.createElement("header");
  header.className = "editor-task-shell__header task-shell__header";
  assignTaskShellRegion(header, "header");

  const navigation = createTaskShellNavigation(options);
  const headingGroup = document.createElement("div");
  headingGroup.className = "editor-task-shell__heading-group task-shell__heading-group";
  assignTaskShellRegion(headingGroup, "heading");

  const title = document.createElement("h2");
  title.className = "editor-task-shell__title task-shell__title";
  title.id = resolveTaskShellTitleId(options);
  title.textContent = options.title;
  assignTaskWindowRegion(title, "title");

  const status = document.createElement("p");
  status.className = "editor-task-shell__status task-shell__status";
  status.id = resolveTaskShellStatusId(options);
  status.textContent = options.status;
  assignTaskShellRegion(status, "status");

  headingGroup.append(title, status);

  const actions = createTaskShellActions(options);
  if (navigation !== null) {
    header.append(navigation);
  }
  header.append(headingGroup);
  if (actions !== null) {
    header.append(actions);
  }

  shell.append(header);

  const stateRegion = createTaskShellStateRegion(options);
  if (stateRegion !== null) {
    shell.append(stateRegion);
  }

  const diagnostics = createTaskShellSlotRegion(
    "diagnostics",
    "aside",
    "editor-task-shell__diagnostics task-shell__diagnostics",
    options.diagnosticsSummary
  );
  if (diagnostics !== null) {
    shell.append(diagnostics);
  }

  const content = createTaskShellSlotRegion(
    "content",
    "div",
    "editor-task-shell__content task-shell__content",
    options.content
  );
  if (content !== null) {
    shell.append(content);
  }

  return shell;
};

const installTaskShellKeyboardAffordances = (
  shell: HTMLElement,
  options: TaskShellOptions
): void => {
  if (!canInvokeTaskShellAffordance(options.close)) {
    return;
  }

  shell.setAttribute("aria-keyshortcuts", "Escape");
  shell.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void options.close?.onClick?.();
  });
};

const createTaskShellNavigation = (options: TaskShellOptions): HTMLElement | null => {
  const buttons = [
    ...(options.back === undefined || options.back === null
      ? []
      : [createTaskShellAffordanceButton("back", "Back", options.back)]),
    ...(options.close === undefined || options.close === null
      ? []
      : [createTaskShellAffordanceButton("close", "Close", options.close)])
  ];

  if (buttons.length === 0) {
    return null;
  }

  const navigation = document.createElement("nav");
  navigation.className = "editor-task-shell__navigation task-shell__navigation";
  navigation.setAttribute("aria-label", "Task navigation");
  assignTaskShellRegion(navigation, "navigation");
  navigation.append(...buttons);
  return navigation;
};

const createTaskShellAffordanceButton = (
  kind: "back" | "close",
  defaultLabel: string,
  affordance: TaskShellAffordanceOptions
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = [
    "editor-task-shell__navigation-button",
    `editor-task-shell__navigation-button--${kind}`,
    "task-shell__navigation-button",
    `task-shell__navigation-button--${kind}`
  ].join(" ");
  button.type = "button";
  button.textContent = affordance.label ?? defaultLabel;
  button.setAttribute("aria-label", affordance.ariaLabel);
  button.dataset.taskShellAffordance = kind;
  button.dataset.taskWindowAffordance = kind;

  if (affordance.title !== undefined) {
    button.setAttribute("title", affordance.title);
  }

  if (affordance.busy === true) {
    button.setAttribute("aria-busy", "true");
  }

  const disabled = affordance.disabled === true || affordance.busy === true;
  button.disabled = disabled;

  if (disabled) {
    button.setAttribute("aria-disabled", "true");
  } else if (affordance.onClick !== undefined) {
    button.addEventListener("click", () => {
      void affordance.onClick?.();
    });
  }

  return button;
};

const canInvokeTaskShellAffordance = (
  affordance: TaskShellAffordanceOptions | null | undefined
): affordance is TaskShellAffordanceOptions & {
  readonly onClick: () => void | Promise<void>;
} =>
  affordance !== undefined &&
  affordance !== null &&
  affordance.onClick !== undefined &&
  affordance.disabled !== true &&
  affordance.busy !== true;

const createTaskShellActions = (options: TaskShellOptions): HTMLElement | null => {
  const primaryAction = createTaskShellSlotRegion(
    "primary-action",
    "div",
    "editor-task-shell__primary-action task-shell__primary-action",
    options.primaryAction
  );
  const secondaryAction = createTaskShellSlotRegion(
    "secondary-action",
    "div",
    "editor-task-shell__secondary-action task-shell__secondary-action",
    options.secondaryAction
  );
  const actionStatus = createTaskShellSlotRegion(
    "action-status",
    "div",
    "editor-task-shell__action-status task-shell__action-status",
    options.actionStatus
  );
  const regions = [primaryAction, secondaryAction, actionStatus].filter(
    (region): region is HTMLElement => region !== null
  );

  if (regions.length === 0) {
    return null;
  }

  const actions = document.createElement("div");
  actions.className = "editor-task-shell__actions task-shell__actions";
  assignTaskShellRegion(actions, "actions");
  actions.append(...regions);
  return actions;
};

const createTaskShellStateRegion = (options: TaskShellOptions): HTMLElement | null => {
  const state = options.state ?? "ready";
  if (state === "ready" && options.stateMessage === undefined) {
    return null;
  }

  const region = document.createElement("p");
  region.className = [
    "editor-task-shell__state",
    `editor-task-shell__state--${state}`,
    "task-shell__state",
    `task-shell__state--${state}`
  ].join(" ");
  region.textContent = options.stateMessage ?? createDefaultTaskShellStateMessage(state);
  region.setAttribute("role", state === "error" ? "alert" : "status");
  assignTaskShellRegion(region, "state");
  return region;
};

const createDefaultTaskShellStateMessage = (state: TaskShellState): string => {
  switch (state) {
    case "loading":
      return "Task is loading.";
    case "error":
      return "Task needs attention.";
    case "disabled":
      return "Task is currently unavailable.";
    case "ready":
      return "";
  }
};

const createTaskShellSlotRegion = (
  region: string,
  tagName: keyof HTMLElementTagNameMap,
  className: string,
  slot: TaskShellSlot
): HTMLElement | null => {
  const elements = normalizeTaskShellSlot(slot);
  if (elements.length === 0) {
    return null;
  }

  const container = document.createElement(tagName);
  container.className = className;
  assignTaskShellRegion(container, region);
  container.append(...elements);
  return container;
};

const normalizeTaskShellSlot = (slot: TaskShellSlot): readonly HTMLElement[] => {
  if (slot === undefined || slot === null) {
    return [];
  }

  if (Array.isArray(slot)) {
    return slot;
  }

  return [slot as HTMLElement];
};

const assignTaskShellRegion = <ElementType extends HTMLElement>(
  element: ElementType,
  region: string,
  taskWindowRegion = region
): ElementType => {
  element.dataset.taskShellRegion = region;
  assignTaskWindowRegion(element, taskWindowRegion);
  return element;
};

const assignTaskWindowRegion = <ElementType extends HTMLElement>(
  element: ElementType,
  region: string
): ElementType => {
  element.dataset.taskWindowRegion = region;
  return element;
};

const resolveTaskShellTitleId = (options: TaskShellOptions): string =>
  options.titleId ?? `${createTaskShellIdPrefix(options)}-title`;

const resolveTaskShellStatusId = (options: TaskShellOptions): string =>
  options.statusId ?? `${createTaskShellIdPrefix(options)}-status`;

const createTaskShellIdPrefix = (options: TaskShellOptions): string =>
  ["task-shell", options.surface.id, options.surfaceMetadata?.group]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .map(toDomIdPart)
    .join("-");

const toDomIdPart = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
