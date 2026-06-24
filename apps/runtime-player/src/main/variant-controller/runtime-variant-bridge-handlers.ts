import { ipcMain, type BrowserWindow } from "electron";

import { runtimeVariantBridgeChannels } from "../../preload/runtime-variant-bridge-channels";
import type {
  RuntimePlayerVariantActionResult,
  RuntimePlayerVariantControllerStatus,
  RuntimePlayerVariantMultiToggleRequest,
  RuntimePlayerVariantSingleSelectRequest
} from "../../preload/runtime-variant-bridge-contract";
import type { RuntimePlayerWindowSet } from "../window-management/runtime-player-windows";
import { RuntimePlayerVariantSessionState } from "./runtime-variant-session-state";

export type RuntimeVariantStatusListener = (
  status: RuntimePlayerVariantControllerStatus
) => void;

export interface RuntimePlayerVariantBridgeRegistration {
  readonly session: RuntimePlayerVariantSessionState;
  readonly getStatus: () => RuntimePlayerVariantControllerStatus;
  readonly setRuntimeExportPayload: (
    payload: Parameters<RuntimePlayerVariantSessionState["setRuntimeExportPayload"]>[0]
  ) => RuntimePlayerVariantControllerStatus;
  readonly clearRuntimeExport: () => RuntimePlayerVariantControllerStatus;
  readonly publishStatus: (
    status?: RuntimePlayerVariantControllerStatus
  ) => RuntimePlayerVariantControllerStatus;
  readonly onStatusChanged: (
    listener: RuntimeVariantStatusListener
  ) => () => void;
}

export function registerRuntimeVariantBridgeHandlers(input: {
  readonly windows: RuntimePlayerWindowSet;
  readonly session?: RuntimePlayerVariantSessionState;
}): RuntimePlayerVariantBridgeRegistration {
  const session = input.session ?? new RuntimePlayerVariantSessionState();
  const listeners = new Set<RuntimeVariantStatusListener>();

  const publishStatus = (
    status = session.getStatus()
  ): RuntimePlayerVariantControllerStatus => {
    sendToWindow(
      input.windows.controlWindow,
      runtimeVariantBridgeChannels.statusChanged,
      status
    );
    sendToWindow(
      input.windows.stageWindow,
      runtimeVariantBridgeChannels.statusChanged,
      status
    );
    for (const listener of listeners) {
      listener(status);
    }
    return status;
  };

  ipcMain.handle(runtimeVariantBridgeChannels.getStatus, () =>
    session.getStatus()
  );
  ipcMain.handle(
    runtimeVariantBridgeChannels.selectSingle,
    (_event, request: RuntimePlayerVariantSingleSelectRequest) =>
      runVariantAction({
        session,
        publishStatus,
        action: () => session.selectSingle(request),
        successMessage: "Variant selection updated."
      })
  );
  ipcMain.handle(
    runtimeVariantBridgeChannels.toggleMulti,
    (_event, request: RuntimePlayerVariantMultiToggleRequest) =>
      runVariantAction({
        session,
        publishStatus,
        action: () => session.toggleMulti(request),
        successMessage: "Variant selection updated."
      })
  );
  ipcMain.handle(runtimeVariantBridgeChannels.resetToDefault, () =>
    runVariantAction({
      session,
      publishStatus,
      action: () => session.resetToDefault(),
      successMessage: "Variant selection reset to model default."
    })
  );

  return {
    session,
    getStatus: () => session.getStatus(),
    setRuntimeExportPayload: (payload) =>
      publishStatus(session.setRuntimeExportPayload(payload)),
    clearRuntimeExport: () =>
      publishStatus(session.clearRuntimeExport()),
    publishStatus,
    onStatusChanged: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

function runVariantAction(input: {
  readonly session: RuntimePlayerVariantSessionState;
  readonly publishStatus: (
    status: RuntimePlayerVariantControllerStatus
  ) => RuntimePlayerVariantControllerStatus;
  readonly action: () => RuntimePlayerVariantControllerStatus;
  readonly successMessage: string;
}): RuntimePlayerVariantActionResult {
  const atIso = new Date().toISOString();
  try {
    const status = input.publishStatus(input.action());
    return {
      result: "ok",
      message: input.successMessage,
      status,
      atIso
    };
  } catch (error) {
    return {
      result: "error",
      message: error instanceof Error ? error.message : String(error),
      status: input.session.getStatus(),
      atIso
    };
  }
}

function sendToWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimePlayerVariantControllerStatus
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}
