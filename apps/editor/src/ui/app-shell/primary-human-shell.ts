import { createAuthoringWorkspacePrimaryLayout } from "./authoring-workspace-v0-shell.js";
import { applyShellSurfaceMetadata, shellSurfaces } from "./shell-surfaces.js";

export const primaryHumanShellTestIds = {
  shell: "primaryHumanShell.shell",
  workspace: "primaryHumanShell.workspace",
  layout: "primaryHumanShell.layout"
} as const;

export interface PrimaryHumanShellOptions {
  readonly appBarSlot?: HTMLElement | null;
  readonly toolboxSurface: HTMLElement;
  readonly partsTreeSurface: HTMLElement;
  readonly canvasPreviewRegion: HTMLElement;
  readonly inspectorSurface: HTMLElement;
  readonly parameterBarSurface: HTMLElement;
  readonly diagnosticsStripSurface: HTMLElement;
  readonly taskWindowSurface?: HTMLElement | null;
}

export const createPrimaryHumanShell = (options: PrimaryHumanShellOptions): HTMLElement => {
  const shell = document.createElement("main");
  shell.className = "primary-human-shell";
  shell.dataset.testid = primaryHumanShellTestIds.shell;
  shell.dataset.primaryHumanShell = "v0";
  applyShellSurfaceMetadata(shell, shellSurfaces.authoringWorkspace, {
    group: "primary-human-shell"
  });

  if (options.appBarSlot !== undefined && options.appBarSlot !== null) {
    options.appBarSlot.dataset.primaryHumanShellRegion = "app-bar";
    shell.append(options.appBarSlot);
  }

  const workspace = document.createElement("section");
  workspace.className = "primary-human-shell__workspace editor-workspace";
  workspace.dataset.testid = primaryHumanShellTestIds.workspace;
  workspace.dataset.primaryHumanShellRegion = "workspace";
  workspace.setAttribute("aria-label", "Primary human authoring workspace");
  applyShellSurfaceMetadata(workspace, shellSurfaces.authoringWorkspace, {
    group: "primary-workspace"
  });

  const layout = createAuthoringWorkspacePrimaryLayout({
    toolboxSurface: options.toolboxSurface,
    partsTreeSurface: options.partsTreeSurface,
    canvasPreviewRegion: options.canvasPreviewRegion,
    inspectorSurface: options.inspectorSurface,
    parameterBarSurface: options.parameterBarSurface,
    diagnosticsStripSurface: options.diagnosticsStripSurface
  });
  layout.className = `${layout.className} primary-human-shell__layout`;
  layout.dataset.testid = primaryHumanShellTestIds.layout;
  layout.dataset.primaryHumanShellRegion = "authoring-layout";
  layout.dataset.primaryHumanShellLayout = "essentials";

  workspace.append(layout);
  if (options.taskWindowSurface !== undefined && options.taskWindowSurface !== null) {
    options.taskWindowSurface.dataset.primaryHumanShellRegion = "active-task";
    workspace.append(options.taskWindowSurface);
  }
  shell.append(workspace);

  return shell;
};
