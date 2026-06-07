import { applyShellSurfaceMetadata, shellSurfaces } from "./shell-surfaces.js";

export type ToolboxSurfaceLabelMode = "compact" | "expanded";
export type ToolboxLauncherGroupKind = "action" | "task" | "view";

export interface ToolboxLauncherItem {
  readonly id: string;
  readonly label: string;
  readonly testId?: string;
  readonly ariaLabel?: string;
  readonly tooltip?: string;
  readonly iconText?: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly badge?: string;
  readonly status?: string;
}

export interface ToolboxSurfaceOptions {
  readonly actions?: readonly ToolboxLauncherItem[];
  readonly tasks?: readonly ToolboxLauncherItem[];
  readonly views?: readonly ToolboxLauncherItem[];
  readonly labelMode?: ToolboxSurfaceLabelMode;
  readonly onActivate: (itemId: string) => void;
}

interface ToolboxLauncherGroup {
  readonly kind: ToolboxLauncherGroupKind;
  readonly label: string;
  readonly items: readonly ToolboxLauncherItem[];
}

export const createToolboxSurface = (options: ToolboxSurfaceOptions): HTMLElement => {
  const surface = document.createElement("section");
  surface.className = "toolbox-surface";
  surface.setAttribute("aria-labelledby", "editor-toolbox-surface-heading");
  applyShellSurfaceMetadata(surface, shellSurfaces.authoringWorkspace, {
    group: "toolbox"
  });

  const heading = document.createElement("h2");
  heading.id = "editor-toolbox-surface-heading";
  heading.textContent = "Toolbox";

  surface.append(heading);

  for (const group of createLauncherGroups(options)) {
    if (group.items.length === 0) {
      continue;
    }

    surface.append(createLauncherGroup(group, options));
  }

  return surface;
};

const createLauncherGroups = (
  options: ToolboxSurfaceOptions
): readonly ToolboxLauncherGroup[] => [
  {
    kind: "action",
    label: "Actions",
    items: options.actions ?? []
  },
  {
    kind: "task",
    label: "Tasks",
    items: options.tasks ?? []
  },
  {
    kind: "view",
    label: "Views",
    items: options.views ?? []
  }
];

const createLauncherGroup = (
  group: ToolboxLauncherGroup,
  options: ToolboxSurfaceOptions
): HTMLElement => {
  const section = document.createElement("section");
  section.className = `toolbox-surface__group toolbox-surface__group--${group.kind}`;
  section.dataset.toolboxGroup = group.kind;
  section.setAttribute("aria-label", group.label);

  const heading = document.createElement("h3");
  heading.className = "toolbox-surface__group-heading";
  heading.textContent = group.label;

  const list = document.createElement("div");
  list.className = "toolbox-surface__items";
  list.setAttribute("role", "list");

  for (const item of group.items) {
    const wrapper = document.createElement("div");
    wrapper.className = "toolbox-surface__item";
    wrapper.setAttribute("role", "listitem");
    wrapper.append(createLauncherButton(item, group.kind, options));
    list.append(wrapper);
  }

  section.append(heading, list);

  return section;
};

const createLauncherButton = (
  item: ToolboxLauncherItem,
  groupKind: ToolboxLauncherGroupKind,
  options: ToolboxSurfaceOptions
): HTMLButtonElement => {
  const disabled = item.disabled ?? false;
  const button = document.createElement("button");
  button.type = "button";
  button.className = `toolbox-surface__button toolbox-surface__button--${groupKind}`;
  button.dataset.toolboxItemId = item.id;
  button.dataset.toolboxItemGroup = groupKind;
  if (item.testId !== undefined) {
    button.dataset.testid = item.testId;
  }
  button.disabled = disabled;
  button.setAttribute("aria-label", item.ariaLabel ?? item.label);
  button.setAttribute("aria-pressed", item.active === true ? "true" : "false");
  button.setAttribute("title", createLauncherTitle(item));

  const description = createLauncherDescription(item);
  if (description.length > 0) {
    button.setAttribute("aria-description", description);
  }

  const icon = document.createElement("span");
  icon.className = "toolbox-surface__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = item.iconText ?? createFallbackIconText(item.label);
  button.append(icon);

  if (options.labelMode === "expanded") {
    const label = document.createElement("span");
    label.className = "toolbox-surface__label";
    label.textContent = item.label;
    button.append(label);
  }

  if (item.badge !== undefined) {
    const badge = document.createElement("span");
    badge.className = "toolbox-surface__badge";
    badge.textContent = item.badge;
    button.append(badge);
  }

  if (item.status !== undefined) {
    const status = document.createElement("span");
    status.className = "toolbox-surface__status";
    status.textContent = item.status;
    button.append(status);
  }

  button.addEventListener("click", () => {
    if (disabled) {
      return;
    }

    options.onActivate(item.id);
  });

  return button;
};

const createLauncherTitle = (item: ToolboxLauncherItem): string =>
  [item.tooltip ?? item.label, item.disabledReason].filter(isNonEmptyString).join(" - ");

const createLauncherDescription = (item: ToolboxLauncherItem): string =>
  [item.status, item.disabledReason].filter(isNonEmptyString).join(". ");

const createFallbackIconText = (label: string): string =>
  label
    .split(/\s+|\/+/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");

const isNonEmptyString = (value: string | undefined): value is string =>
  value !== undefined && value.length > 0;
