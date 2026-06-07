export type ShellSurfaceKind = "authoring-workspace" | "task" | "view";

export interface ShellSurfaceDefinition {
  readonly id: string;
  readonly kind: ShellSurfaceKind;
  readonly label: string;
}

export interface ShellSurfaceMetadataOptions {
  readonly group?: string;
}

export const shellSurfaces = {
  authoringWorkspace: {
    id: "authoringWorkspace",
    kind: "authoring-workspace",
    label: "Authoring Workspace"
  },
  psdImportTask: {
    id: "psdImportTask",
    kind: "task",
    label: "PSD Import Task"
  },
  sourceIntakeTask: {
    id: "sourceIntakeTask",
    kind: "task",
    label: "Source Intake Task"
  },
  projectStorageTask: {
    id: "projectStorageTask",
    kind: "task",
    label: "Project Storage Task"
  },
  validationTask: {
    id: "validationTask",
    kind: "task",
    label: "Validation Task"
  },
  tutorialTask: {
    id: "tutorialTask",
    kind: "task",
    label: "Tutorial Task"
  },
  viewerRuntimeView: {
    id: "viewerRuntimeView",
    kind: "view",
    label: "Viewer / Runtime View"
  },
  diagnosticsEvidenceView: {
    id: "diagnosticsEvidenceView",
    kind: "view",
    label: "Diagnostics / Evidence View"
  },
  codexAutomationView: {
    id: "codexAutomationView",
    kind: "view",
    label: "Codex / Automation View"
  }
} as const satisfies Record<string, ShellSurfaceDefinition>;

export const shellSurfaceDefinitions = Object.values(shellSurfaces);

export const applyShellSurfaceMetadata = (
  element: HTMLElement,
  surface: ShellSurfaceDefinition,
  options: ShellSurfaceMetadataOptions = {}
): HTMLElement => {
  element.dataset.shellSurfaceId = surface.id;
  element.dataset.shellSurfaceKind = surface.kind;
  element.dataset.shellSurfaceLabel = surface.label;

  if (options.group !== undefined) {
    element.dataset.shellSurfaceGroup = options.group;
  }

  return element;
};
