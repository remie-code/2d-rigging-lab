import { BrowserWindow } from "electron";

import {
  createControlWindowOptions,
  createStageWindowOptions
} from "./browser-window-options";
import {
  type RuntimePlayerRendererEntry,
  getControlPreloadFilePath,
  getRendererDevUrl,
  getRendererHtmlFilePath,
  getStagePreloadFilePath
} from "./renderer-entry-url";
import type { RuntimePlayerWindowStateController } from "../window-state/window-state-controller";
import type { RuntimePlayerWindowStateDocument } from "../window-state/window-state-document";

export type RuntimePlayerWindowSet = {
  readonly controlWindow: BrowserWindow;
  readonly stageWindow: BrowserWindow;
};

export type CreateRuntimePlayerWindowsOptions = {
  readonly windowState?: RuntimePlayerWindowStateDocument;
};

export function createRuntimePlayerWindows(
  options: CreateRuntimePlayerWindowsOptions = {}
): RuntimePlayerWindowSet {
  const controlPreloadFilePath = getControlPreloadFilePath();
  const stagePreloadFilePath = getStagePreloadFilePath();
  const controlWindow = new BrowserWindow(
    createControlWindowOptions(
      controlPreloadFilePath,
      options.windowState?.windows.control?.bounds
    )
  );
  const stageWindow = new BrowserWindow(
    createStageWindowOptions(
      stagePreloadFilePath,
      options.windowState?.windows.stage?.bounds,
      {
        alwaysOnTop:
          options.windowState?.stageEnvironment.alwaysOnTop ?? false
      }
    )
  );

  controlWindow.once("ready-to-show", () => {
    controlWindow.show();
  });

  stageWindow.once("ready-to-show", () => {
    stageWindow.showInactive();
  });

  return {
    controlWindow,
    stageWindow
  };
}

export function attachRuntimePlayerWindowStateTracking(input: {
  readonly windows: RuntimePlayerWindowSet;
  readonly windowState: RuntimePlayerWindowStateController;
}): void {
  attachWindowBoundsTracking(input.windows.controlWindow, "control", input);
  attachWindowBoundsTracking(input.windows.stageWindow, "stage", input);
}

export async function loadRuntimePlayerWindows(
  windows: RuntimePlayerWindowSet
): Promise<void> {
  await Promise.all([
    loadRendererEntry(windows.controlWindow, "control"),
    loadRendererEntry(windows.stageWindow, "stage")
  ]);
}

async function loadRendererEntry(
  window: BrowserWindow,
  entry: RuntimePlayerRendererEntry
): Promise<void> {
  const devUrl = getRendererDevUrl(entry);

  if (devUrl) {
    await window.loadURL(devUrl);
    return;
  }

  await window.loadFile(getRendererHtmlFilePath(entry));
}

function attachWindowBoundsTracking(
  window: BrowserWindow,
  windowKey: "control" | "stage",
  input: {
    readonly windowState: RuntimePlayerWindowStateController;
  }
): void {
  const updateBounds = (): void => {
    if (window.isDestroyed()) {
      return;
    }

    input.windowState.updateWindowBounds(windowKey, window.getBounds());
  };

  updateBounds();
  window.on("move", updateBounds);
  window.on("resize", updateBounds);
  window.on("close", () => {
    updateBounds();
    void input.windowState.flush();
  });
}
