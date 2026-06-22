import { ipcMain, type BrowserWindow } from "electron";

import { stageViewBridgeChannels } from "../preload/stage-view-bridge-channels";
import type { RuntimePlayerStageViewStatus } from "../preload/runtime-player-bridge-contract";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";
import { RuntimePlayerStageViewStatusState } from "./stage-view-status-state";

export interface RegisterStageViewBridgeHandlersInput {
  readonly windows: RuntimePlayerWindowSet;
  readonly state?: RuntimePlayerStageViewStatusState;
}

export function registerStageViewBridgeHandlers(
  input: RegisterStageViewBridgeHandlersInput
): RuntimePlayerStageViewStatusState {
  const state = input.state ?? new RuntimePlayerStageViewStatusState();

  ipcMain.handle(stageViewBridgeChannels.getStatus, () => state.getStatus());
  ipcMain.handle(stageViewBridgeChannels.reportStatus, (_event, report: unknown) => {
    const status = state.setReportedStatus(report);
    sendToWindow(
      input.windows.controlWindow,
      stageViewBridgeChannels.statusChanged,
      status
    );
    return status;
  });

  return state;
}

function sendToWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimePlayerStageViewStatus
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}
