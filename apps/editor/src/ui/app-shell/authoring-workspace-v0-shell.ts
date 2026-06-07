import {
  editorTestIds,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";
import {
  createPartsTreeSurface,
  type PartsTreeSurfaceOptions
} from "./parts-tree-surface.js";
import { applyShellSurfaceMetadata, shellSurfaces } from "./shell-surfaces.js";
import { createToolboxSurface, type ToolboxLauncherItem } from "./toolbox-surface.js";
import {
  createWorkspaceDiagnosticsStripSurface,
  createWorkspaceInspectorSurface,
  createWorkspaceParameterBarSurface,
  type WorkspaceActiveParameterSummary,
  type WorkspaceDiagnosticsSummaryItem,
  type WorkspaceInspectorSelectionSummary
} from "./workspace-context-surfaces.js";
import type { EditorAppShellOptions } from "./app-shell.js";

export const createAuthoringWorkspacePrimaryLayout = (options: {
  readonly toolboxSurface: HTMLElement;
  readonly partsTreeSurface: HTMLElement;
  readonly canvasPreviewRegion: HTMLElement;
  readonly inspectorSurface: HTMLElement;
  readonly parameterBarSurface: HTMLElement;
  readonly diagnosticsStripSurface: HTMLElement;
}): HTMLElement => {
  const layout = document.createElement("section");
  layout.className = "authoring-workspace-v0";
  layout.setAttribute("aria-label", "Authoring workspace v0 layout");
  applyShellSurfaceMetadata(layout, shellSurfaces.authoringWorkspace, {
    group: "workspace-v0"
  });
  layout.append(
    options.toolboxSurface,
    options.partsTreeSurface,
    options.canvasPreviewRegion,
    options.inspectorSurface,
    options.parameterBarSurface,
    options.diagnosticsStripSurface
  );

  return layout;
};

export const createCanvasPreviewRegion = (previewPanel: HTMLElement): HTMLElement => {
  const region = document.createElement("section");
  region.className = "authoring-workspace-v0__canvas";
  region.dataset.workspaceRegion = "canvas-preview";
  region.setAttribute("aria-label", "Canvas / Preview");
  applyShellSurfaceMetadata(region, shellSurfaces.authoringWorkspace, {
    group: "canvas-preview"
  });
  region.append(previewPanel);

  return region;
};

export const createWorkspaceSupportRegion = (panels: readonly HTMLElement[]): HTMLElement => {
  const region = document.createElement("section");
  region.className = "authoring-workspace-support";
  region.setAttribute("aria-label", "Workspace support panels");
  applyShellSurfaceMetadata(region, shellSurfaces.authoringWorkspace, {
    group: "legacy-support"
  });
  region.append(...panels);

  return region;
};

export const createAuthoringToolboxSurface = (options: EditorAppShellOptions): HTMLElement =>
  createToolboxSurface({
    actions: createToolboxActionItems(),
    tasks: createToolboxTaskItems(options),
    views: createToolboxViewItems(options),
    onActivate(itemId) {
      switch (itemId) {
        case "import-psd":
          options.onOpenPsdImportTask?.();
          break;
        case "viewer-runtime":
          options.onOpenViewerRuntimeSurface();
          break;
      }
    }
  });

export const createPartsTreeShellSurface = (
  options: EditorAppShellOptions
): HTMLElement =>
  createPartsTreeSurface({
    layerTree: createLayerTreePanelOptions(options),
    drawableList: {
      drawables: options.viewModel.drawableAuthoring.drawables,
      layerControls: options.viewModel.drawableLayers,
      onToggleRuntimeVisibility: options.onToggleDrawableRuntimeVisibility,
      onMoveLayer: options.onMoveDrawableLayer
    }
  });

export const createWorkspaceInspectorShellSurface = (
  options: EditorAppShellOptions
): HTMLElement =>
  applyShellSurfaceMetadata(
    createWorkspaceInspectorSurface({
      project: {
        title: options.viewModel.packageTitle,
        status: options.viewModel.packageRevisionLabel,
        facts: [
          { label: "Parameters", value: options.viewModel.parameterCountLabel },
          { label: "Drawables", value: options.viewModel.drawableCountLabel },
          { label: "Parts", value: options.viewModel.layerTree.partCountLabel }
        ]
      },
      selection: createWorkspaceSelectionSummary(options),
      tool: {
        label: "Select",
        status:
          options.viewModel.layerTree.selectedDrawableIds.length === 0
            ? "Choose a drawable from Structure / Parts or Canvas."
            : "Drawable selection is active.",
        facts: [
          { label: "Layer state", value: options.viewModel.layerTree.selectedCountLabel },
          { label: "Preview", value: options.viewModel.previewControls.parameterCountLabel }
        ]
      }
    }),
    shellSurfaces.authoringWorkspace,
    { group: "inspector" }
  );

export const createWorkspaceParameterBarShellSurface = (
  options: EditorAppShellOptions
): HTMLElement =>
  applyShellSurfaceMetadata(
    createWorkspaceParameterBarSurface({
      activeParameter: createWorkspaceActiveParameterSummary(options),
      onChangeCurrentValue: options.onSetPreviewParameterValue,
      onResetCurrentValue: () => options.onResetPreviewParameterValues()
    }),
    shellSurfaces.authoringWorkspace,
    { group: "parameter-bar" }
  );

export const createWorkspaceDiagnosticsStripShellSurface = (
  options: EditorAppShellOptions
): HTMLElement => {
  const blockingCount =
    options.state.productPreflight.status === "failed"
      ? 1
      : options.state.productPreflight.blockingIssues.length;
  const warningCount =
    options.state.productPreflight.warnings.length +
    options.state.productPreflight.unsupportedClaimCount +
    options.state.productPreflight.notEvaluatedClaimCount;

  return applyShellSurfaceMetadata(
    createWorkspaceDiagnosticsStripSurface({
      blockingCount,
      warningCount,
      statusLabel: createWorkspaceDiagnosticsStatusLabel(options, blockingCount, warningCount),
      items: createWorkspaceDiagnosticsItems(options),
      maxVisibleItems: 3
    }),
    shellSurfaces.authoringWorkspace,
    { group: "diagnostics-strip" }
  );
};

const createToolboxActionItems = (): readonly ToolboxLauncherItem[] => [
  {
    id: "select",
    label: "Select",
    ariaLabel: "Select parts or drawables",
    tooltip: "Select parts or drawables",
    iconText: "S",
    active: true,
    status: "Ready"
  },
  {
    id: "mesh",
    label: "Mesh",
    ariaLabel: "Mesh tools",
    tooltip: "Mesh tools",
    iconText: "M",
    disabled: true,
    disabledReason: "Detailed controls are in support panels"
  },
  {
    id: "rig",
    label: "Rig",
    ariaLabel: "Rig tools",
    tooltip: "Rig tools",
    iconText: "R",
    disabled: true,
    disabledReason: "Detailed controls are in support panels"
  },
  {
    id: "dynamics",
    label: "Dynamics",
    ariaLabel: "Dynamics tools",
    tooltip: "Dynamics tools",
    iconText: "D",
    disabled: true,
    disabledReason: "Detailed controls are in support panels"
  }
];

const createToolboxTaskItems = (
  options: EditorAppShellOptions
): readonly ToolboxLauncherItem[] => [
  {
    id: "import-psd",
    label: "Import PSD",
    testId: editorTestIds.psdImportTaskOpen,
    ariaLabel: "Import PSD",
    tooltip: "Import PSD",
    iconText: "PSD",
    active: options.activeTask === "psdImport",
    disabled: options.onOpenPsdImportTask === undefined,
    ...(options.onOpenPsdImportTask === undefined
      ? { disabledReason: "PSD Import task route unavailable" }
      : {}),
    status: options.activeTask === "psdImport" ? "Open" : "Task"
  },
  {
    id: "parameter-manager",
    label: "Parameters",
    ariaLabel: "Open Parameter Manager",
    tooltip: "Parameter Manager",
    iconText: "P",
    disabled: true,
    disabledReason: "Dedicated manager is not available yet"
  },
  {
    id: "storage",
    label: "Storage",
    ariaLabel: "Open project storage",
    tooltip: "Project storage",
    iconText: "ST",
    disabled: true,
    disabledReason: "Available in support panels"
  },
  {
    id: "validate",
    label: "Validate",
    ariaLabel: "Open Product Preflight",
    tooltip: "Product Preflight",
    iconText: "V",
    disabled: true,
    disabledReason: "Available in support panels"
  }
];

const createToolboxViewItems = (
  options: EditorAppShellOptions
): readonly ToolboxLauncherItem[] => [
  {
    id: "viewer-runtime",
    label: "Viewer",
    ariaLabel: "Open Viewer / Runtime",
    tooltip: "Viewer / Runtime",
    iconText: "VR",
    disabled: !options.viewModel.isPackageLoaded,
    ...(options.viewModel.isPackageLoaded ? {} : { disabledReason: "No package loaded" }),
    ...(options.viewModel.viewerRuntime.isOpen ? { status: "Open" } : {})
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    ariaLabel: "Open Diagnostics / Evidence",
    tooltip: "Diagnostics / Evidence",
    iconText: "DX",
    disabled: true,
    disabledReason: "Dedicated view is not available yet"
  },
  {
    id: "codex",
    label: "Codex",
    ariaLabel: "Open Codex / Automation",
    tooltip: "Codex / Automation",
    iconText: "CX",
    disabled: true,
    disabledReason: "Dedicated view is not available yet"
  }
];

const createWorkspaceSelectionSummary = (
  options: EditorAppShellOptions
): WorkspaceInspectorSelectionSummary => {
  const selectedDrawable = options.viewModel.layerTree.partGroups
    .flatMap((partGroup) => partGroup.drawables)
    .find((drawable) => drawable.selected);

  if (selectedDrawable === undefined) {
    return {
      kind: "none",
      label: "No selection",
      status: "Select a part or drawable to inspect it."
    };
  }

  return {
    kind: "drawable",
    label: `${selectedDrawable.displayName} / ${selectedDrawable.drawableId}`,
    status: selectedDrawable.stateLabel,
    facts: [
      { label: "Part", value: selectedDrawable.partId },
      { label: "Draw order", value: selectedDrawable.orderLabel },
      { label: "Texture", value: selectedDrawable.textureStatusLabel }
    ]
  };
};

const createWorkspaceActiveParameterSummary = (
  options: EditorAppShellOptions
): WorkspaceActiveParameterSummary | null => {
  const activeParameter = options.viewModel.previewControls.parameterControls[0];
  if (activeParameter === undefined) {
    return null;
  }

  return {
    parameterId: activeParameter.parameterId,
    displayName: activeParameter.displayName,
    min: activeParameter.min,
    max: activeParameter.max,
    defaultValue: activeParameter.defaultValue,
    currentValue: activeParameter.currentValue,
    recommendedUiStep: activeParameter.recommendedUiStep,
    valueSourceLabel: formatParameterValueSource(activeParameter.valueSource),
    disabled: activeParameter.disabled,
    disabledReason: activeParameter.disabledMessage,
    keyMarkers: [
      {
        value: activeParameter.defaultValue,
        label: "Default",
        selected: activeParameter.currentValue === activeParameter.defaultValue
      }
    ]
  };
};

const createWorkspaceDiagnosticsStatusLabel = (
  options: EditorAppShellOptions,
  blockingCount: number,
  warningCount: number
): string => {
  if (options.state.productPreflight.status === "failed") {
    return `${blockingCount} blocking / preflight failed`;
  }

  return `${blockingCount} blocking / ${warningCount} warning${warningCount === 1 ? "" : "s"}`;
};

const createWorkspaceDiagnosticsItems = (
  options: EditorAppShellOptions
): readonly WorkspaceDiagnosticsSummaryItem[] => [
  ...(options.state.productPreflight.errorMessage === null
    ? []
    : [{
        severity: "blocking" as const,
        label: options.state.productPreflight.errorMessage,
        targetLabel: "Product Preflight"
      }]),
  ...options.state.productPreflight.blockingIssues.map((issue) => ({
    severity: "blocking" as const,
    label: issue.message,
    targetLabel: issue.category
  })),
  ...options.state.productPreflight.warnings.map((warning) => ({
    severity: "warning" as const,
    label: warning.message,
    targetLabel: warning.category
  })),
  ...options.state.productPreflight.unsupportedClaims.map((claim) => ({
    severity: "warning" as const,
    label: `Unsupported claim: ${claim.capabilityLabel}`,
    targetLabel: claim.category
  })),
  ...options.state.productPreflight.notEvaluatedClaims.map((claim) => ({
    severity: "warning" as const,
    label: `Not evaluated: ${claim.evidenceKind}`,
    targetLabel: claim.category
  }))
];

const createLayerTreePanelOptions = (
  options: EditorAppShellOptions
): PartsTreeSurfaceOptions["layerTree"] => ({
  viewModel: options.viewModel.layerTree,
  workflow: options.viewModel.partTextureWorkflow,
  onCreatePart: options.onCommitCreatePart,
  onUpdatePart: options.onCommitUpdatePart,
  onSetDrawablePart: options.onCommitSetDrawablePart,
  onSetDrawableTexture: options.onCommitSetDrawableTexture,
  ...(options.onDraftLayerTreePartRename === undefined
    ? {}
    : { onDraftPartRename: options.onDraftLayerTreePartRename }),
  ...(options.onDraftLayerTreePartReparent === undefined
    ? {}
    : { onDraftPartReparent: options.onDraftLayerTreePartReparent }),
  ...(options.onDraftLayerTreeEmptyLeafPartDelete === undefined
    ? {}
    : { onDraftEmptyLeafPartDelete: options.onDraftLayerTreeEmptyLeafPartDelete }),
  ...(options.onDraftLayerTreeDrawablePartAssignment === undefined
    ? {}
    : { onDraftDrawablePartAssignment: options.onDraftLayerTreeDrawablePartAssignment }),
  ...(options.onDraftLayerTreeDrawableTextureAssignment === undefined
    ? {}
    : { onDraftDrawableTextureAssignment: options.onDraftLayerTreeDrawableTextureAssignment }),
  ...(options.onCommitLayerTreeDirectManipulationDrafts === undefined
    ? {}
    : { onCommitDirectManipulationDrafts: options.onCommitLayerTreeDirectManipulationDrafts }),
  ...(options.onClearLayerTreeDirectManipulationDrafts === undefined
    ? {}
    : { onClearDirectManipulationDrafts: options.onClearLayerTreeDirectManipulationDrafts }),
  onSelectDrawable: options.onSelectDrawableLayer,
  onToggleDrawableLock: options.onToggleDrawableLayerLock,
  onToggleDrawableEditorHidden: options.onToggleDrawableEditorHidden
});

const formatParameterValueSource = (
  valueSource: EditorWorkflowViewModel["previewControls"]["parameterControls"][number]["valueSource"]
): string => {
  switch (valueSource) {
    case "authoredInput":
      return "authored input";
    case "computedDynamics":
      return "computed dynamics";
    case "debugOverride":
      return "debug override";
  }
};
