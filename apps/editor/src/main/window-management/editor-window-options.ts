import type { BrowserWindowConstructorOptions } from "electron";

export type EditorWindowBounds = {
  readonly x?: number;
  readonly y?: number;
  readonly width: number;
  readonly height: number;
};

export const editorWindowDefaultBounds = {
  width: 1280,
  height: 800,
  minWidth: 960,
  minHeight: 600
} as const;

export function createEditorWindowOptions(
  preloadFilePath: string,
  restoredBounds?: EditorWindowBounds
): BrowserWindowConstructorOptions {
  return {
    ...createRestoredBoundsOptions(editorWindowDefaultBounds, restoredBounds),
    title: "Private 2D Rigging Lab",
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

function createRestoredBoundsOptions(
  defaults: typeof editorWindowDefaultBounds,
  restoredBounds: EditorWindowBounds | undefined
): Pick<
  BrowserWindowConstructorOptions,
  "x" | "y" | "width" | "height" | "minWidth" | "minHeight"
> {
  if (restoredBounds === undefined) {
    return defaults;
  }

  return {
    ...(restoredBounds.x === undefined ? {} : { x: restoredBounds.x }),
    ...(restoredBounds.y === undefined ? {} : { y: restoredBounds.y }),
    width: Math.max(defaults.minWidth, restoredBounds.width),
    height: Math.max(defaults.minHeight, restoredBounds.height),
    minWidth: defaults.minWidth,
    minHeight: defaults.minHeight
  };
}
