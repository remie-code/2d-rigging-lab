import { ipcMain, type BrowserWindow } from "electron";

import { liveParameterBridgeChannels } from "../preload/live-parameter-bridge-channels";
import type { RuntimePlayerLiveParameterFrame } from "../preload/live-parameter-bridge-contract";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

export type RuntimePlayerLiveParameterBridgeRegistration = {
  readonly getLatestFrame: () => RuntimePlayerLiveParameterFrame | null;
  readonly publishFrame: (
    frame: RuntimePlayerLiveParameterFrame,
    options?: RuntimePlayerLiveParameterPublishOptions
  ) => void;
  readonly publishLatestFrameToStageWindow: (
    options?: RuntimePlayerLiveParameterReplayOptions
  ) => void;
  readonly setStageWindowLiveFrameDeliveryEnabled: (enabled: boolean) => void;
  readonly clearStageWindowLiveParameterFrame: () => void;
  readonly clear: () => void;
};

export type RuntimePlayerLiveParameterPublishOptions = {
  readonly deliverToStageWindow?: boolean;
};

export type RuntimePlayerLiveParameterReplayOptions = {
  readonly resetBeforePublish?: boolean;
};

export function registerLiveParameterBridgeHandlers(input: {
  readonly windows: RuntimePlayerWindowSet;
}): RuntimePlayerLiveParameterBridgeRegistration {
  let latestFrame: RuntimePlayerLiveParameterFrame | null = null;
  let stageWindowLiveFrameDeliveryEnabled = true;

  ipcMain.handle(liveParameterBridgeChannels.getLatestFrame, () =>
    stageWindowLiveFrameDeliveryEnabled ? latestFrame : null
  );

  return {
    getLatestFrame: () => latestFrame,
    publishFrame: (frame, options = {}) => {
      latestFrame = frame;
      if (
        stageWindowLiveFrameDeliveryEnabled &&
        (options.deliverToStageWindow ?? true)
      ) {
        sendLiveFrameToStageWindow(input.windows.stageWindow, frame);
      }
    },
    publishLatestFrameToStageWindow: (options = {}) => {
      if (options.resetBeforePublish ?? false) {
        sendLiveFrameClearToStageWindow(input.windows.stageWindow);
      }
      if (latestFrame !== null) {
        sendLiveFrameToStageWindow(input.windows.stageWindow, latestFrame);
      }
    },
    setStageWindowLiveFrameDeliveryEnabled: (enabled) => {
      stageWindowLiveFrameDeliveryEnabled = enabled;
    },
    clearStageWindowLiveParameterFrame: () => {
      sendLiveFrameClearToStageWindow(input.windows.stageWindow);
    },
    clear: () => {
      latestFrame = null;
      sendLiveFrameClearToStageWindow(input.windows.stageWindow);
    }
  };
}

function sendLiveFrameToStageWindow(
  window: BrowserWindow,
  frame: RuntimePlayerLiveParameterFrame
): void {
  sendToWindow(window, liveParameterBridgeChannels.frame, frame);
}

function sendLiveFrameClearToStageWindow(window: BrowserWindow): void {
  sendToWindow(window, liveParameterBridgeChannels.cleared);
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
