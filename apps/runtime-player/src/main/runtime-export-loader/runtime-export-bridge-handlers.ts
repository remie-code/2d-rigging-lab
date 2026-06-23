import { dialog, ipcMain, type BrowserWindow } from "electron";

import { runtimeExportBridgeChannels } from "../../preload/runtime-export-bridge-channels";
import type {
  RuntimeExportLoadedPayload,
  RuntimeExportOpenDirectoryResult,
  RuntimeExportStatus
} from "../../preload/runtime-export-bridge-contract";
import type { RuntimePlayerWindowSet } from "../window-management/runtime-player-windows";
import {
  loadRuntimeExportDirectory,
  type RuntimeExportDirectoryLoadResult
} from "./runtime-export-directory-loader";
import { toRuntimeExportLoadError } from "./runtime-export-errors";
import { RuntimeExportSessionState } from "./runtime-export-session-state";

export type RuntimeExportDirectoryLoader = (
  directoryPath: string
) => Promise<RuntimeExportDirectoryLoadResult>;

type MaybePromise<T> = T | Promise<T>;

export interface RegisterRuntimeExportBridgeHandlersInput {
  readonly windows: RuntimePlayerWindowSet;
  readonly session?: RuntimeExportSessionState;
  readonly loadDirectory?: RuntimeExportDirectoryLoader;
  readonly onRuntimeExportChanging?: () => MaybePromise<void>;
  readonly onRuntimeExportLoaded?: (
    payload: RuntimeExportLoadedPayload
  ) => MaybePromise<void>;
  readonly onRuntimeExportCleared?: () => MaybePromise<void>;
}

export function registerRuntimeExportBridgeHandlers(
  input: RegisterRuntimeExportBridgeHandlersInput
): RuntimeExportSessionState {
  const session = input.session ?? new RuntimeExportSessionState();
  const loadDirectory = input.loadDirectory ?? loadRuntimeExportDirectory;

  ipcMain.handle(runtimeExportBridgeChannels.getStatus, () => session.getStatus());
  ipcMain.handle(runtimeExportBridgeChannels.getLoadedPayload, () =>
    session.getLoadedPayload()
  );
  ipcMain.handle(runtimeExportBridgeChannels.openDirectory, async () =>
    openRuntimeExportDirectory({
      windows: input.windows,
      session,
      loadDirectory,
      ...(input.onRuntimeExportChanging === undefined
        ? {}
        : { onRuntimeExportChanging: input.onRuntimeExportChanging }),
      ...(input.onRuntimeExportLoaded === undefined
        ? {}
        : { onRuntimeExportLoaded: input.onRuntimeExportLoaded }),
      ...(input.onRuntimeExportCleared === undefined
        ? {}
        : { onRuntimeExportCleared: input.onRuntimeExportCleared })
    })
  );

  return session;
}

async function openRuntimeExportDirectory(input: {
  readonly windows: RuntimePlayerWindowSet;
  readonly session: RuntimeExportSessionState;
  readonly loadDirectory: RuntimeExportDirectoryLoader;
  readonly onRuntimeExportChanging?: () => MaybePromise<void>;
  readonly onRuntimeExportLoaded?: (
    payload: RuntimeExportLoadedPayload
  ) => MaybePromise<void>;
  readonly onRuntimeExportCleared?: () => MaybePromise<void>;
}): Promise<RuntimeExportOpenDirectoryResult> {
  const selection = await dialog.showOpenDialog(input.windows.controlWindow, {
    title: "Open Runtime Export",
    buttonLabel: "Open Runtime Export",
    properties: ["openDirectory"]
  });

  if (selection.canceled || selection.filePaths[0] === undefined) {
    return {
      result: "canceled",
      runtimeExport: input.session.getStatus()
    };
  }

  const directoryPath = selection.filePaths[0];
  await input.onRuntimeExportChanging?.();
  broadcastStatus(
    input.windows,
    input.session.setLoading(directoryPath)
  );

  try {
    const loaded = await input.loadDirectory(directoryPath);
    const status = input.session.setLoaded({
      directoryPath: loaded.directoryPath,
      payload: loaded.payload
    });

    await input.onRuntimeExportLoaded?.(loaded.payload);
    broadcastStatus(input.windows, status);
    sendToWindow(
      input.windows.stageWindow,
      runtimeExportBridgeChannels.loadedPayload,
      loaded.payload
    );

    return {
      result: "loaded",
      runtimeExport: status
    };
  } catch (error) {
    const status = input.session.setError({
      directoryPath,
      error: toRuntimeExportLoadError(error),
      failedAtIso: new Date().toISOString()
    });

    await input.onRuntimeExportCleared?.();
    broadcastStatus(input.windows, status);

    return {
      result: "error",
      runtimeExport: status
    };
  }
}

function broadcastStatus(
  windows: RuntimePlayerWindowSet,
  status: RuntimeExportStatus
): void {
  sendToWindow(
    windows.controlWindow,
    runtimeExportBridgeChannels.statusChanged,
    status
  );
  sendToWindow(
    windows.stageWindow,
    runtimeExportBridgeChannels.statusChanged,
    status
  );
}

function sendToWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimeExportStatus | RuntimeExportLoadedPayload
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}
