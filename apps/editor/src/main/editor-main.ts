import { app, BrowserWindow } from "electron";

import {
  createEditorWindow,
  loadEditorWindow
} from "./window-management/editor-window";

export function startEditorMain(): void {
  app.whenReady().then(async () => {
    const editorWindow = createEditorWindow();
    await loadEditorWindow(editorWindow);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const reopenedWindow = createEditorWindow();
        void loadEditorWindow(reopenedWindow);
        return;
      }

      const [existingWindow] = BrowserWindow.getAllWindows();
      existingWindow?.show();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
