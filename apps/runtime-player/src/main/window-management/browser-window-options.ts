import type { BrowserWindowConstructorOptions } from "electron";

export const controlWindowDefaultBounds = {
  width: 1040,
  height: 760,
  minWidth: 820,
  minHeight: 620
} as const;

export const stageWindowDefaultBounds = {
  width: 720,
  height: 900,
  minWidth: 360,
  minHeight: 480
} as const;

export function createControlWindowOptions(
  preloadFilePath: string
): BrowserWindowConstructorOptions {
  return {
    ...controlWindowDefaultBounds,
    title: "Runtime Player",
    show: false,
    backgroundColor: "#101214",
    webPreferences: {
      preload: preloadFilePath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  };
}

export function createStageWindowOptions(
  preloadFilePath: string
): BrowserWindowConstructorOptions {
  return {
    ...stageWindowDefaultBounds,
    title: "Runtime Player Stage",
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: preloadFilePath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  };
}
