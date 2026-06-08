export const legacyDebugQuarantineSurfaceTestIds = {
  root: "legacyDebugQuarantineSurface.root",
  boundary: "legacyDebugQuarantineSurface.boundary",
  status: "legacyDebugQuarantineSurface.status",
  panelHost: "legacyDebugQuarantineSurface.panelHost",
  emptyState: "legacyDebugQuarantineSurface.emptyState"
} as const;

export const legacyDebugQuarantineSurfaceMetadata = {
  surfaceId: "legacyDebugQuarantineSurface",
  surfaceKind: "debug-quarantine",
  surfaceLabel: "Legacy Debug Quarantine",
  surfaceGroup: "debug-quarantine",
  shellSurfacePrimary: "false",
  primaryAuthoringSurface: "false",
  authoringWorkspaceFlow: "false",
  internalDebugSurface: "true",
  quarantineSurface: "true",
  primaryUiAbsence: "normal-authoring-workspace-does-not-mount-legacy-panels",
  quarantinePresence: "legacy-panel-reachability-preserved-outside-primary-flow"
} as const;

const titleId = "legacy-debug-quarantine-surface-title";
const boundaryId = "legacy-debug-quarantine-surface-boundary";
const statusId = "legacy-debug-quarantine-surface-status";

export const createLegacyDebugQuarantineSurface = (
  panels: readonly HTMLElement[] = []
): HTMLElement => {
  const surface = document.createElement("section");
  surface.className = "legacy-debug-quarantine-surface";
  surface.dataset.testid = legacyDebugQuarantineSurfaceTestIds.root;
  surface.dataset.shellSurfaceId = legacyDebugQuarantineSurfaceMetadata.surfaceId;
  surface.dataset.shellSurfaceKind = legacyDebugQuarantineSurfaceMetadata.surfaceKind;
  surface.dataset.shellSurfaceLabel = legacyDebugQuarantineSurfaceMetadata.surfaceLabel;
  surface.dataset.shellSurfaceGroup = legacyDebugQuarantineSurfaceMetadata.surfaceGroup;
  surface.dataset.shellSurfacePrimary = legacyDebugQuarantineSurfaceMetadata.shellSurfacePrimary;
  surface.dataset.primaryAuthoringSurface = legacyDebugQuarantineSurfaceMetadata.primaryAuthoringSurface;
  surface.dataset.authoringWorkspaceFlow = legacyDebugQuarantineSurfaceMetadata.authoringWorkspaceFlow;
  surface.dataset.internalDebugSurface = legacyDebugQuarantineSurfaceMetadata.internalDebugSurface;
  surface.dataset.quarantineSurface = legacyDebugQuarantineSurfaceMetadata.quarantineSurface;
  surface.dataset.primaryUiAbsence = legacyDebugQuarantineSurfaceMetadata.primaryUiAbsence;
  surface.dataset.quarantinePresence = legacyDebugQuarantineSurfaceMetadata.quarantinePresence;
  surface.dataset.legacyDebugQuarantinePanelCount = String(panels.length);
  surface.setAttribute("aria-labelledby", titleId);
  surface.setAttribute("aria-describedby", `${boundaryId} ${statusId}`);

  const header = document.createElement("header");
  header.className = "legacy-debug-quarantine-surface__header";

  const title = document.createElement("h2");
  title.id = titleId;
  title.textContent = "Legacy Debug Quarantine";

  const boundary = document.createElement("p");
  boundary.id = boundaryId;
  boundary.className = "legacy-debug-quarantine-surface__boundary";
  boundary.dataset.testid = legacyDebugQuarantineSurfaceTestIds.boundary;
  boundary.textContent =
    "Primary UI absence means the normal authoring workspace does not mount these panels. Quarantine / specialized surface presence preserves internal debug reachability outside the primary flow.";

  const status = document.createElement("p");
  status.id = statusId;
  status.className = "legacy-debug-quarantine-surface__status";
  status.dataset.testid = legacyDebugQuarantineSurfaceTestIds.status;
  status.textContent =
    panels.length === 0
      ? "No legacy/debug panels are currently mounted in this non-primary quarantine surface."
      : `${panels.length} legacy/debug panel${panels.length === 1 ? "" : "s"} preserved in this non-primary quarantine surface.`;

  header.append(title, boundary, status);

  const panelHost = document.createElement("div");
  panelHost.className = "legacy-debug-quarantine-surface__panel-host";
  panelHost.dataset.testid = legacyDebugQuarantineSurfaceTestIds.panelHost;
  panelHost.dataset.quarantinePanelHost = "true";
  panelHost.setAttribute("aria-label", "Legacy debug quarantine panel host");

  if (panels.length === 0) {
    panelHost.append(createEmptyState());
  } else {
    panelHost.append(...panels);
  }

  surface.append(header, panelHost);

  return surface;
};

const createEmptyState = (): HTMLElement => {
  const emptyState = document.createElement("p");
  emptyState.className = "legacy-debug-quarantine-surface__empty-state";
  emptyState.dataset.testid = legacyDebugQuarantineSurfaceTestIds.emptyState;
  emptyState.textContent =
    "Primary UI absence is expected; quarantine presence is empty until Domain G attaches internal legacy/debug panels.";

  return emptyState;
};
