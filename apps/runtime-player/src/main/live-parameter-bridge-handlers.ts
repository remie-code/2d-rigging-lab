import { ipcMain, type BrowserWindow } from "electron";

import { liveParameterBridgeChannels } from "../preload/live-parameter-bridge-channels";
import type { RuntimePlayerLiveParameterFrame } from "../preload/live-parameter-bridge-contract";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

export type RuntimePlayerLiveParameterBridgeRegistration = {
  readonly getLatestFrame: () => RuntimePlayerLiveParameterFrame | null;
  readonly publishFrame: (frame: RuntimePlayerLiveParameterFrame) => void;
  readonly clear: () => void;
};

export function registerLiveParameterBridgeHandlers(input: {
  readonly windows: RuntimePlayerWindowSet;
}): RuntimePlayerLiveParameterBridgeRegistration {
  let latestFrame: RuntimePlayerLiveParameterFrame | null = null;

  ipcMain.handle(liveParameterBridgeChannels.getLatestFrame, () => latestFrame);

  return {
    getLatestFrame: () => latestFrame,
    publishFrame: (frame) => {
      latestFrame = frame;
      sendToWindow(input.windows.stageWindow, liveParameterBridgeChannels.frame, frame);
    },
    clear: () => {
      latestFrame = null;
      sendToWindow(input.windows.stageWindow, liveParameterBridgeChannels.cleared);
    }
  };
}

function sendToWindow(
  window: BrowserWindow,
  channel: string,
  payload?: RuntimePlayerLiveParameterFrame
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  if (payload === undefined) {
    window.webContents.send(channel);
    return;
  }

  window.webContents.send(channel, payload);
}
