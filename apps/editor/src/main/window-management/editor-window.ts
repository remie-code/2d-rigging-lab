import { BrowserWindow } from "electron";

import { createEditorWindowOptions } from "./editor-window-options";
import {
  getEditorPreloadFilePath,
  getEditorRendererDevUrl,
  getEditorRendererHtmlFilePath
} from "./renderer-entry";

export function createEditorWindow(): BrowserWindow {
  const preloadFilePath = getEditorPreloadFilePath();
  const editorWindow = new BrowserWindow(
    createEditorWindowOptions(preloadFilePath)
  );

  editorWindow.once("ready-to-show", () => {
    editorWindow.show();
  });

  return editorWindow;
}

export async function loadEditorWindow(window: BrowserWindow): Promise<void> {
  const devUrl = getEditorRendererDevUrl();

  if (devUrl) {
    await window.loadURL(devUrl);
    return;
  }

  await window.loadFile(getEditorRendererHtmlFilePath());
}
