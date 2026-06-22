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

export type RuntimePlayerWindowSet = {
  readonly controlWindow: BrowserWindow;
  readonly stageWindow: BrowserWindow;
};

export function createRuntimePlayerWindows(): RuntimePlayerWindowSet {
  const controlPreloadFilePath = getControlPreloadFilePath();
  const stagePreloadFilePath = getStagePreloadFilePath();
  const controlWindow = new BrowserWindow(
    createControlWindowOptions(controlPreloadFilePath)
  );
  const stageWindow = new BrowserWindow(
    createStageWindowOptions(stagePreloadFilePath)
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
