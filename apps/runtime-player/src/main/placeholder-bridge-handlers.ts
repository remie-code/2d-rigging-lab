import { ipcMain } from "electron";

import { placeholderBridgeChannels } from "../preload/placeholder-bridge-channels";
import {
  createPlaceholderResult,
  createStageStatus,
  createStartupStatus,
  isRuntimePlayerPlaceholderAction
} from "./placeholder-action-state";

export function registerPlaceholderBridgeHandlers(): void {
  ipcMain.handle(placeholderBridgeChannels.getStartupStatus, () =>
    createStartupStatus()
  );

  ipcMain.handle(placeholderBridgeChannels.getStageStatus, () =>
    createStageStatus()
  );

  ipcMain.handle(
    placeholderBridgeChannels.performPlaceholderAction,
    (_event, action: unknown) => {
      if (!isRuntimePlayerPlaceholderAction(action)) {
        throw new Error("Unsupported Runtime Player placeholder action.");
      }

      return createPlaceholderResult(action);
    }
  );

  ipcMain.handle(placeholderBridgeChannels.focusStage, () => {
    return createPlaceholderResult("focus-stage");
  });

  ipcMain.handle(placeholderBridgeChannels.resetStagePosition, () => {
    return createPlaceholderResult("reset-stage-position");
  });
}
