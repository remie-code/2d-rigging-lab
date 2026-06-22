import { app } from "electron";

import { registerPlaceholderBridgeHandlers } from "./placeholder-bridge-handlers";
import { registerRuntimeExportBridgeHandlers } from "./runtime-export-loader/runtime-export-bridge-handlers";
import { registerStageViewBridgeHandlers } from "./stage-view-bridge-handlers";
import {
  createRuntimePlayerWindows,
  loadRuntimePlayerWindows
} from "./window-management/runtime-player-windows";

export function startRuntimePlayerMain(): void {
  app.whenReady().then(async () => {
    const windows = createRuntimePlayerWindows();
    registerPlaceholderBridgeHandlers({ windows });
    registerStageViewBridgeHandlers({ windows });
    registerRuntimeExportBridgeHandlers({ windows });
    await loadRuntimePlayerWindows(windows);

    app.on("activate", () => {
      if (windows.controlWindow.isDestroyed()) {
        return;
      }

      windows.controlWindow.show();
      windows.controlWindow.focus();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
