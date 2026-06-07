export const workspaceContextSurfaceTestIds = {
  inspectorSurface: "workspaceContext.inspector",
  inspectorProjectSummary: "workspaceContext.inspector.projectSummary",
  inspectorSelectionSummary: "workspaceContext.inspector.selectionSummary",
  inspectorToolSummary: "workspaceContext.inspector.toolSummary",
  inspectorRevealSelection: "workspaceContext.inspector.revealSelection",
  inspectorFocusCanvas: "workspaceContext.inspector.focusCanvas",
  inspectorOpenToolDetails: "workspaceContext.inspector.openToolDetails",
  parameterBarSurface: "workspaceContext.parameterBar",
  parameterBarCurrentValue: "workspaceContext.parameterBar.currentValue",
  parameterBarReset: "workspaceContext.parameterBar.reset",
  parameterBarAddOrUpdateKeyform: "workspaceContext.parameterBar.addOrUpdateKeyform",
  parameterBarPreviousKey: "workspaceContext.parameterBar.previousKey",
  parameterBarNextKey: "workspaceContext.parameterBar.nextKey",
  parameterBarQuickCreate: "workspaceContext.parameterBar.quickCreate",
  parameterBarOpenManager: "workspaceContext.parameterBar.openManager",
  diagnosticsStripSurface: "workspaceContext.diagnosticsStrip",
  diagnosticsStripSummary: "workspaceContext.diagnosticsStrip.summary",
  diagnosticsStripOpenDetails: "workspaceContext.diagnosticsStrip.openDetails"
} as const;

export interface WorkspaceSummaryFact {
  readonly label: string;
  readonly value: string;
}

export interface WorkspaceInspectorProjectSummary {
  readonly title: string;
  readonly status: string;
  readonly facts?: readonly WorkspaceSummaryFact[];
}

export interface WorkspaceInspectorSelectionSummary {
  readonly kind: "project" | "part" | "drawable" | "tool" | "none";
  readonly label: string;
  readonly status: string;
  readonly facts?: readonly WorkspaceSummaryFact[];
}

export interface WorkspaceInspectorToolSummary {
  readonly label: string;
  readonly status: string;
  readonly facts?: readonly WorkspaceSummaryFact[];
}

export interface WorkspaceInspectorSurfaceOptions {
  readonly project: WorkspaceInspectorProjectSummary;
  readonly selection?: WorkspaceInspectorSelectionSummary | null;
  readonly tool?: WorkspaceInspectorToolSummary | null;
  readonly onRevealSelectionInPartsTree?: () => void;
  readonly onFocusSelectionInCanvas?: () => void;
  readonly onOpenToolDetails?: () => void;
}

export interface WorkspaceParameterKeyMarker {
  readonly value: number;
  readonly label: string;
  readonly selected?: boolean;
}

export interface WorkspaceActiveParameterSummary {
  readonly parameterId: string;
  readonly displayName: string;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly currentValue: number;
  readonly recommendedUiStep: number;
  readonly valueSourceLabel?: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string | null;
  readonly keyMarkers?: readonly WorkspaceParameterKeyMarker[];
}

export interface WorkspaceParameterBarOptions {
  readonly activeParameter: WorkspaceActiveParameterSummary | null;
  readonly onChangeCurrentValue?: (parameterId: string, value: number) => void;
  readonly onResetCurrentValue?: (parameterId: string) => void;
  readonly onAddOrUpdateKeyform?: (parameterId: string, value: number) => void;
  readonly onPreviousKeyform?: (parameterId: string) => void;
  readonly onNextKeyform?: (parameterId: string) => void;
  readonly onQuickCreateParameter?: () => void;
  readonly onOpenParameterManager?: () => void;
}

export interface WorkspaceDiagnosticsSummaryItem {
  readonly severity: "blocking" | "warning";
  readonly label: string;
  readonly targetLabel?: string;
}

export interface WorkspaceDiagnosticsStripOptions {
  readonly blockingCount: number;
  readonly warningCount: number;
  readonly statusLabel?: string;
  readonly items?: readonly WorkspaceDiagnosticsSummaryItem[];
  readonly maxVisibleItems?: number;
  readonly onOpenDiagnostics?: () => void;
}

export const createWorkspaceInspectorSurface = (
  options: WorkspaceInspectorSurfaceOptions
): HTMLElement => {
  const surface = document.createElement("aside");
  surface.className = "workspace-context-surface workspace-context-surface--inspector";
  surface.dataset.testid = workspaceContextSurfaceTestIds.inspectorSurface;
  surface.dataset.workspaceContextSurface = "inspector";
  surface.setAttribute("aria-labelledby", "workspace-context-inspector-title");

  const title = createHeading("h2", "workspace-context-inspector-title", "Inspector");
  surface.append(title);
  surface.append(
    createInspectorSummarySection({
      className: "workspace-context-surface__section workspace-context-surface__section--project",
      title: "Project",
      headingId: "workspace-context-inspector-project-title",
      testId: workspaceContextSurfaceTestIds.inspectorProjectSummary,
      label: options.project.title,
      status: options.project.status,
      facts: options.project.facts
    })
  );

  const selection = options.selection ?? null;
  surface.append(
    createInspectorSummarySection({
      className: "workspace-context-surface__section workspace-context-surface__section--selection",
      title: "Selection",
      headingId: "workspace-context-inspector-selection-title",
      testId: workspaceContextSurfaceTestIds.inspectorSelectionSummary,
      label: selection?.label ?? "No selection",
      status: selection?.status ?? "Select a part or drawable to inspect it.",
      facts: selection?.facts,
      empty: selection === null || selection.kind === "none"
    })
  );

  surface.append(
    createInspectorSummarySection({
      className: "workspace-context-surface__section workspace-context-surface__section--tool",
      title: "Active Tool",
      headingId: "workspace-context-inspector-tool-title",
      testId: workspaceContextSurfaceTestIds.inspectorToolSummary,
      label: options.tool?.label ?? "Select",
      status: options.tool?.status ?? "No contextual tool controls active.",
      facts: options.tool?.facts,
      empty: options.tool === null
    })
  );

  const actions = createInspectorActions(options, selection);
  if (actions !== null) {
    surface.append(actions);
  }

  return surface;
};

export const createWorkspaceParameterBarSurface = (
  options: WorkspaceParameterBarOptions
): HTMLElement => {
  const surface = document.createElement("section");
  surface.className = "workspace-context-surface workspace-context-surface--parameter-bar";
  surface.dataset.testid = workspaceContextSurfaceTestIds.parameterBarSurface;
  surface.dataset.workspaceContextSurface = "parameterBar";
  surface.setAttribute("aria-labelledby", "workspace-context-parameter-bar-title");

  const title = createHeading("h2", "workspace-context-parameter-bar-title", "Parameter Bar");
  surface.append(title);

  if (options.activeParameter === null) {
    surface.append(createEmptyParameterSummary(options));
    return surface;
  }

  const parameter = options.activeParameter;
  const disabled = parameter.disabled === true;
  let currentValue = parameter.currentValue;

  const summary = document.createElement("div");
  summary.className = "workspace-context-surface__parameter-summary";
  const currentValueText = createLabeledText(
    "Current",
    formatParameterCurrentValue(parameter, currentValue)
  );
  summary.append(
    createLabeledText("Parameter", `${parameter.displayName} / ${parameter.parameterId}`),
    createLabeledText(
      "Range",
      `${formatSurfaceNumber(parameter.min)} to ${formatSurfaceNumber(parameter.max)}; default ${formatSurfaceNumber(parameter.defaultValue)}`
    ),
    currentValueText
  );
  if (parameter.disabledReason !== undefined && parameter.disabledReason !== null) {
    summary.append(createLabeledText("Blocked", parameter.disabledReason));
  }
  surface.append(summary);

  const controls = document.createElement("div");
  controls.className = "workspace-context-surface__parameter-controls";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.dataset.testid = workspaceContextSurfaceTestIds.parameterBarCurrentValue;
  slider.setAttribute("aria-label", `Current value for ${parameter.displayName}`);
  slider.min = String(parameter.min);
  slider.max = String(parameter.max);
  slider.step = String(parameter.recommendedUiStep);
  slider.value = String(parameter.currentValue);
  slider.disabled = disabled || options.onChangeCurrentValue === undefined;
  if (slider.disabled) {
    slider.setAttribute("aria-disabled", "true");
  } else {
    slider.addEventListener("input", () => {
      const nextValue = Number(slider.value);
      if (Number.isFinite(nextValue)) {
        currentValue = nextValue;
        currentValueText.textContent = `Current: ${formatParameterCurrentValue(parameter, currentValue)}`;
        options.onChangeCurrentValue?.(parameter.parameterId, nextValue);
      }
    });
  }
  controls.append(slider);
  controls.append(createKeyMarkerList(parameter));
  surface.append(controls);

  surface.append(createParameterActions(options, parameter, disabled, () => currentValue));
  return surface;
};

export const createWorkspaceDiagnosticsStripSurface = (
  options: WorkspaceDiagnosticsStripOptions
): HTMLElement => {
  const surface = document.createElement("aside");
  surface.className = "workspace-context-surface workspace-context-surface--diagnostics-strip";
  surface.dataset.testid = workspaceContextSurfaceTestIds.diagnosticsStripSurface;
  surface.dataset.workspaceContextSurface = "diagnosticsStrip";
  surface.setAttribute("aria-labelledby", "workspace-context-diagnostics-strip-title");
  surface.setAttribute("aria-live", "polite");

  const title = createHeading("h2", "workspace-context-diagnostics-strip-title", "Diagnostics");
  surface.append(title);

  const summary = document.createElement("p");
  summary.className = "workspace-context-surface__diagnostics-summary";
  summary.dataset.testid = workspaceContextSurfaceTestIds.diagnosticsStripSummary;
  summary.textContent =
    options.statusLabel ??
    `${options.blockingCount} blocking / ${options.warningCount} warning`;
  surface.append(summary);

  const items = (options.items ?? []).filter(
    (item) => item.severity === "blocking" || item.severity === "warning"
  );
  if (items.length > 0) {
    surface.append(createDiagnosticsSummaryList(items, options.maxVisibleItems ?? 3));
  }

  const openDetails = createActionButton({
    className: "workspace-context-surface__action workspace-context-surface__action--diagnostics",
    label: "Details",
    ariaLabel: "Open diagnostics and evidence details",
    testId: workspaceContextSurfaceTestIds.diagnosticsStripOpenDetails,
    disabled: options.onOpenDiagnostics === undefined,
    onClick: options.onOpenDiagnostics
  });
  surface.append(openDetails);

  return surface;
};

const createInspectorSummarySection = (options: {
  readonly className: string;
  readonly title: string;
  readonly headingId: string;
  readonly testId: string;
  readonly label: string;
  readonly status: string;
  readonly facts?: readonly WorkspaceSummaryFact[] | undefined;
  readonly empty?: boolean;
}): HTMLElement => {
  const section = document.createElement("section");
  section.className = options.className;
  section.dataset.testid = options.testId;
  section.setAttribute("aria-labelledby", options.headingId);
  if (options.empty === true) {
    section.dataset.workspaceContextEmpty = "true";
  }

  section.append(createHeading("h3", options.headingId, options.title));

  const label = document.createElement("p");
  label.className = "workspace-context-surface__label";
  label.textContent = options.label;

  const status = document.createElement("p");
  status.className = "workspace-context-surface__status";
  status.textContent = options.status;

  section.append(label, status);

  const facts = createFactList(options.facts ?? []);
  if (facts !== null) {
    section.append(facts);
  }

  return section;
};

const createInspectorActions = (
  options: WorkspaceInspectorSurfaceOptions,
  selection: WorkspaceInspectorSelectionSummary | null
): HTMLElement | null => {
  const hasSelection = selection !== null && selection.kind !== "none";
  const actions = [
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Show in Parts",
      ariaLabel: "Reveal selected item in Parts Tree",
      testId: workspaceContextSurfaceTestIds.inspectorRevealSelection,
      disabled: !hasSelection || options.onRevealSelectionInPartsTree === undefined,
      onClick: options.onRevealSelectionInPartsTree
    }),
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Focus Canvas",
      ariaLabel: "Focus selected item in Canvas",
      testId: workspaceContextSurfaceTestIds.inspectorFocusCanvas,
      disabled: !hasSelection || options.onFocusSelectionInCanvas === undefined,
      onClick: options.onFocusSelectionInCanvas
    }),
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Tool Details",
      ariaLabel: "Open active tool details",
      testId: workspaceContextSurfaceTestIds.inspectorOpenToolDetails,
      disabled: options.tool === null || options.tool === undefined || options.onOpenToolDetails === undefined,
      onClick: options.onOpenToolDetails
    })
  ];

  const actionGroup = document.createElement("div");
  actionGroup.className = "workspace-context-surface__actions";
  actionGroup.append(...actions);
  return actionGroup;
};

const createEmptyParameterSummary = (options: WorkspaceParameterBarOptions): HTMLElement => {
  const container = document.createElement("div");
  container.className = "workspace-context-surface__empty-parameter";

  const summary = document.createElement("p");
  summary.textContent = "No active parameter selected.";
  container.append(summary);

  const actions = document.createElement("div");
  actions.className = "workspace-context-surface__actions";
  actions.append(
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Quick Create",
      ariaLabel: "Quick create parameter",
      testId: workspaceContextSurfaceTestIds.parameterBarQuickCreate,
      disabled: options.onQuickCreateParameter === undefined,
      onClick: options.onQuickCreateParameter
    }),
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Manager",
      ariaLabel: "Open Parameter Manager",
      testId: workspaceContextSurfaceTestIds.parameterBarOpenManager,
      disabled: options.onOpenParameterManager === undefined,
      onClick: options.onOpenParameterManager
    })
  );
  container.append(actions);

  return container;
};

const createParameterActions = (
  options: WorkspaceParameterBarOptions,
  parameter: WorkspaceActiveParameterSummary,
  disabled: boolean,
  getCurrentValue: () => number
): HTMLElement => {
  const actions = document.createElement("div");
  actions.className = "workspace-context-surface__actions workspace-context-surface__actions--parameter";
  actions.append(
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Prev Key",
      ariaLabel: `Previous keyform for ${parameter.displayName}`,
      testId: workspaceContextSurfaceTestIds.parameterBarPreviousKey,
      disabled: disabled || options.onPreviousKeyform === undefined,
      onClick: () => options.onPreviousKeyform?.(parameter.parameterId)
    }),
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Next Key",
      ariaLabel: `Next keyform for ${parameter.displayName}`,
      testId: workspaceContextSurfaceTestIds.parameterBarNextKey,
      disabled: disabled || options.onNextKeyform === undefined,
      onClick: () => options.onNextKeyform?.(parameter.parameterId)
    }),
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Reset",
      ariaLabel: `Reset ${parameter.displayName} to default`,
      testId: workspaceContextSurfaceTestIds.parameterBarReset,
      disabled: disabled || options.onResetCurrentValue === undefined,
      onClick: () => options.onResetCurrentValue?.(parameter.parameterId)
    }),
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Add / Update Key",
      ariaLabel: `Add or update keyform for ${parameter.displayName}`,
      testId: workspaceContextSurfaceTestIds.parameterBarAddOrUpdateKeyform,
      disabled: disabled || options.onAddOrUpdateKeyform === undefined,
      onClick: () => options.onAddOrUpdateKeyform?.(parameter.parameterId, getCurrentValue())
    }),
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Quick Create",
      ariaLabel: "Quick create parameter",
      testId: workspaceContextSurfaceTestIds.parameterBarQuickCreate,
      disabled: options.onQuickCreateParameter === undefined,
      onClick: options.onQuickCreateParameter
    }),
    createActionButton({
      className: "workspace-context-surface__action",
      label: "Manager",
      ariaLabel: "Open Parameter Manager",
      testId: workspaceContextSurfaceTestIds.parameterBarOpenManager,
      disabled: options.onOpenParameterManager === undefined,
      onClick: options.onOpenParameterManager
    })
  );

  return actions;
};

const createKeyMarkerList = (parameter: WorkspaceActiveParameterSummary): HTMLElement => {
  const markerList = document.createElement("ul");
  markerList.className = "workspace-context-surface__key-markers";
  markerList.setAttribute("aria-label", `Key markers for ${parameter.displayName}`);

  const markers = parameter.keyMarkers ?? [];
  if (markers.length === 0) {
    const item = document.createElement("li");
    item.className = "workspace-context-surface__key-marker workspace-context-surface__key-marker--empty";
    item.textContent = "No key markers";
    markerList.append(item);
    return markerList;
  }

  for (const marker of markers) {
    const item = document.createElement("li");
    item.className = marker.selected === true
      ? "workspace-context-surface__key-marker workspace-context-surface__key-marker--selected"
      : "workspace-context-surface__key-marker";
    item.dataset.parameterKeyValue = formatSurfaceNumber(marker.value);
    item.textContent = `${marker.label}: ${formatSurfaceNumber(marker.value)}`;
    markerList.append(item);
  }

  return markerList;
};

const createDiagnosticsSummaryList = (
  items: readonly WorkspaceDiagnosticsSummaryItem[],
  maxVisibleItems: number
): HTMLElement => {
  const list = document.createElement("ul");
  list.className = "workspace-context-surface__diagnostics-list";
  const visibleItems = items.slice(0, Math.max(0, maxVisibleItems));

  for (const item of visibleItems) {
    const listItem = document.createElement("li");
    listItem.className = `workspace-context-surface__diagnostics-item workspace-context-surface__diagnostics-item--${item.severity}`;
    listItem.dataset.diagnosticsSeverity = item.severity;
    listItem.textContent =
      item.targetLabel === undefined ? item.label : `${item.label} / ${item.targetLabel}`;
    list.append(listItem);
  }

  if (items.length > visibleItems.length) {
    const remainder = document.createElement("li");
    remainder.className = "workspace-context-surface__diagnostics-item workspace-context-surface__diagnostics-item--overflow";
    remainder.textContent = `${items.length - visibleItems.length} more summary item${items.length - visibleItems.length === 1 ? "" : "s"}`;
    list.append(remainder);
  }

  return list;
};

const createFactList = (facts: readonly WorkspaceSummaryFact[]): HTMLElement | null => {
  if (facts.length === 0) {
    return null;
  }

  const list = document.createElement("dl");
  list.className = "workspace-context-surface__facts";
  for (const fact of facts) {
    list.append(createFactTerm(fact.label), createFactDescription(fact.value));
  }
  return list;
};

const createFactTerm = (label: string): HTMLElement => {
  const term = document.createElement("dt");
  term.textContent = label;
  return term;
};

const createFactDescription = (value: string): HTMLElement => {
  const description = document.createElement("dd");
  description.textContent = value;
  return description;
};

const createLabeledText = (label: string, value: string): HTMLElement => {
  const row = document.createElement("p");
  row.className = "workspace-context-surface__fact-line";
  row.textContent = `${label}: ${value}`;
  return row;
};

const formatParameterCurrentValue = (
  parameter: WorkspaceActiveParameterSummary,
  currentValue: number
): string =>
  `${formatSurfaceNumber(currentValue)}${parameter.valueSourceLabel === undefined ? "" : ` / ${parameter.valueSourceLabel}`}`;

const createActionButton = (options: {
  readonly className: string;
  readonly label: string;
  readonly ariaLabel: string;
  readonly testId: string;
  readonly disabled: boolean;
  readonly onClick?: (() => void) | undefined;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = options.className;
  button.type = "button";
  button.textContent = options.label;
  button.dataset.testid = options.testId;
  button.setAttribute("aria-label", options.ariaLabel);
  button.disabled = options.disabled;
  if (options.disabled) {
    button.setAttribute("aria-disabled", "true");
  } else if (options.onClick !== undefined) {
    button.addEventListener("click", options.onClick);
  }
  return button;
};

const createHeading = (
  tagName: "h2" | "h3",
  id: string,
  text: string
): HTMLElement => {
  const heading = document.createElement(tagName);
  heading.id = id;
  heading.textContent = text;
  return heading;
};

const formatSurfaceNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
