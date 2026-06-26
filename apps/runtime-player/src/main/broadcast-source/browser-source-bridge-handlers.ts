import { ipcMain, type BrowserWindow } from "electron";

import { browserSourceBridgeChannels } from "../../preload/browser-source-bridge-channels";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../../preload/browser-source-status-contract";
import type {
  RuntimePlayerRuntimeCoreProfilingMode
} from "../../preload/performance-diagnostics-contract";
import type { RuntimePlayerWindowSet } from "../window-management/runtime-player-windows";

export type RuntimePlayerBrowserSourceStatusProvider = {
  readonly getStatus: () => RuntimePlayerBrowserSourceStatus;
  readonly onStatusChanged: (
    listener: (status: RuntimePlayerBrowserSourceStatus) => void
  ) => () => void;
  readonly setRuntimeCoreProfiling?: (
    mode: RuntimePlayerRuntimeCoreProfilingMode
  ) => RuntimePlayerRuntimeCoreProfilingMode;
};

export type RuntimePlayerBrowserSourceBridgeRegistration = {
  readonly dispose: () => void;
};

export function registerBrowserSourceBridgeHandlers(input: {
  readonly windows: RuntimePlayerWindowSet;
  readonly statusProvider: RuntimePlayerBrowserSourceStatusProvider;
}): RuntimePlayerBrowserSourceBridgeRegistration {
  ipcMain.handle(browserSourceBridgeChannels.getStatus, () =>
    input.statusProvider.getStatus()
  );
  ipcMain.handle(
    browserSourceBridgeChannels.setRuntimeCoreProfiling,
    (_event, mode: unknown) => {
      const profilingMode = readRuntimeCoreProfilingMode(mode);
      return input.statusProvider.setRuntimeCoreProfiling?.(profilingMode) ??
        profilingMode;
    }
  );

  const unsubscribe = input.statusProvider.onStatusChanged((status) => {
    sendToControlWindow(
      input.windows.controlWindow,
      browserSourceBridgeChannels.statusChanged,
      status
    );
  });

  return {
    dispose: unsubscribe
  };
}

function readRuntimeCoreProfilingMode(
  value: unknown
): RuntimePlayerRuntimeCoreProfilingMode {
  if (value === "disabled" || value === "deep") {
    return value;
  }

  throw new Error("Browser Source runtime-core profiling mode is unsupported.");
}

function sendToControlWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimePlayerBrowserSourceStatus
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}
