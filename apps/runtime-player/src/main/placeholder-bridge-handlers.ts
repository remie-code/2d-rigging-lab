import { ipcMain, type BrowserWindow } from "electron";

import { placeholderBridgeChannels } from "../preload/placeholder-bridge-channels";
import { stageViewBridgeChannels } from "../preload/stage-view-bridge-channels";
import {
  createPlaceholderResult,
  createStageStatus,
  createStartupStatus,
  isRuntimePlayerPlaceholderAction
} from "./placeholder-action-state";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

export interface RegisterPlaceholderBridgeHandlersInput {
  readonly windows?: RuntimePlayerWindowSet;
}

export function registerPlaceholderBridgeHandlers(
  input: RegisterPlaceholderBridgeHandlersInput = {}
): void {
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
    sendToWindow(
      input.windows?.stageWindow,
      stageViewBridgeChannels.resetRequested
    );

    return createPlaceholderResult("reset-stage-position", {
      handled: true,
      message: "Stage view reset was requested."
    });
  });
}

function sendToWindow(
  window: BrowserWindow | undefined,
  channel: string
): void {
  if (
    window === undefined ||
    window.isDestroyed() ||
    window.webContents.isDestroyed()
  ) {
    return;
  }

  window.webContents.send(channel);
}
