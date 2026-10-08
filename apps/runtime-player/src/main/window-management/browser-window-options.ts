import type { BrowserWindowConstructorOptions } from "electron";
import {
  runtimePlayerStageWindowTitle,
  type RuntimePlayerWindowBounds
} from "../../preload/runtime-player-bridge-contract";

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
  preloadFilePath: string,
  restoredBounds?: RuntimePlayerWindowBounds,
  options: {
    readonly title?: string;
  } = {}
): BrowserWindowConstructorOptions {
  return {
    ...createRestoredBoundsOptions(
      controlWindowDefaultBounds,
      restoredBounds
    ),
    title: options.title ?? "Runtime Player",
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
  preloadFilePath: string,
  restoredBounds?: RuntimePlayerWindowBounds,
  options: {
    readonly alwaysOnTop?: boolean;
    readonly title?: string;
  } = {}
): BrowserWindowConstructorOptions {
  return {
    ...createRestoredBoundsOptions(
      stageWindowDefaultBounds,
      restoredBounds
    ),
    title: options.title ?? runtimePlayerStageWindowTitle,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: options.alwaysOnTop ?? false,
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

function createRestoredBoundsOptions(
  defaults: typeof controlWindowDefaultBounds | typeof stageWindowDefaultBounds,
  restoredBounds: RuntimePlayerWindowBounds | undefined
): Pick<
  BrowserWindowConstructorOptions,
  "x" | "y" | "width" | "height" | "minWidth" | "minHeight"
> {
  if (restoredBounds === undefined) {
    return defaults;
  }

  return {
    x: restoredBounds.x,
    y: restoredBounds.y,
    width: Math.max(defaults.minWidth, restoredBounds.width),
    height: Math.max(defaults.minHeight, restoredBounds.height),
    minWidth: defaults.minWidth,
    minHeight: defaults.minHeight
  };
}
