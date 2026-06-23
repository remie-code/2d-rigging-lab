import { ipcMain, type BrowserWindow } from "electron";

import { stageViewBridgeChannels } from "../preload/stage-view-bridge-channels";
import type {
  RuntimePlayerStageStateSnapshot,
  RuntimePlayerStageViewActionResult,
  RuntimePlayerStageViewStatus,
  RuntimePlayerStageViewTransform
} from "../preload/runtime-player-bridge-contract";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";
import { RuntimePlayerStageViewStatusState } from "./stage-view-status-state";
import type { RuntimePlayerWindowStateController } from "./window-state/window-state-controller";
import {
  centerRuntimePlayerStageViewTransform,
  createResetRuntimePlayerStageViewTransform,
  normalizeRuntimePlayerStageViewTransform
} from "./window-state/window-state-document";

export interface RegisterStageViewBridgeHandlersInput {
  readonly windows: RuntimePlayerWindowSet;
  readonly windowState: RuntimePlayerWindowStateController;
  readonly state?: RuntimePlayerStageViewStatusState;
}

export function registerStageViewBridgeHandlers(
  input: RegisterStageViewBridgeHandlersInput
): RuntimePlayerStageViewStatusState {
  const state = input.state ?? new RuntimePlayerStageViewStatusState();
  const getState = (): RuntimePlayerStageStateSnapshot =>
    createStageStateSnapshot(input, state.getStatus());
  const publishState = (): void => {
    sendToWindow(
      input.windows.controlWindow,
      stageViewBridgeChannels.stateChanged,
      getState()
    );
  };

  input.windowState.subscribe(publishState);

  ipcMain.handle(stageViewBridgeChannels.getStatus, () => state.getStatus());
  ipcMain.handle(stageViewBridgeChannels.getState, () => getState());
  ipcMain.handle(stageViewBridgeChannels.getViewTransform, () =>
    input.windowState.getStageViewTransform()
  );
  ipcMain.handle(stageViewBridgeChannels.reportStatus, (_event, report: unknown) => {
    const status = state.setReportedStatus(report);
    sendToWindow(
      input.windows.controlWindow,
      stageViewBridgeChannels.statusChanged,
      status
    );
    publishState();
    return status;
  });
  ipcMain.handle(
    stageViewBridgeChannels.reportViewTransform,
    (_event, transform: unknown) => {
      input.windowState.updateStageViewTransform(transform);
      return getState();
    }
  );
  ipcMain.handle(stageViewBridgeChannels.focusStage, () =>
    focusStageWindow(input, getState)
  );
  ipcMain.handle(stageViewBridgeChannels.resetView, () => {
    const transform = input.windowState.updateStageViewTransform(
      createResetRuntimePlayerStageViewTransform()
    );
    sendToWindow(
      input.windows.stageWindow,
      stageViewBridgeChannels.applyViewTransformRequested,
      transform
    );

    return createStageViewActionResult({
      message: "Stage view reset.",
      status: getState()
    });
  });
  ipcMain.handle(stageViewBridgeChannels.centerModel, () => {
    const transform = input.windowState.updateStageViewTransform(
      centerRuntimePlayerStageViewTransform(
        input.windowState.getStageViewTransform()
      )
    );
    sendToWindow(
      input.windows.stageWindow,
      stageViewBridgeChannels.applyViewTransformRequested,
      transform
    );

    return createStageViewActionResult({
      message: "Stage model centered.",
      status: getState()
    });
  });

  return state;
}

function sendToWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimePlayerStageViewStatus |
    RuntimePlayerStageStateSnapshot |
    RuntimePlayerStageViewTransform
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}

function createStageStateSnapshot(
  input: RegisterStageViewBridgeHandlersInput,
  renderStatus: RuntimePlayerStageViewStatus
): RuntimePlayerStageStateSnapshot {
  return {
    stageWindow: input.windows.stageWindow.isDestroyed()
      ? {
          windowState: "destroyed",
          bounds: null
        }
      : {
          windowState: "created",
          bounds: input.windows.stageWindow.getBounds()
        },
    stageView: {
      renderStatus,
      transform: normalizeRuntimePlayerStageViewTransform(
        input.windowState.getStageViewTransform()
      )
    },
    persistence: input.windowState.getPersistenceSnapshot()
  };
}

function focusStageWindow(
  input: RegisterStageViewBridgeHandlersInput,
  getState: () => RuntimePlayerStageStateSnapshot
): RuntimePlayerStageViewActionResult {
  const stageWindow = input.windows.stageWindow;

  if (stageWindow.isDestroyed()) {
    return createStageViewActionResult({
      result: "error",
      message: "Stage Window is not available.",
      status: getState()
    });
  }

  if (stageWindow.isMinimized()) {
    stageWindow.restore();
  }

  stageWindow.show();
  stageWindow.focus();

  return createStageViewActionResult({
    message: "Stage Window focused.",
    status: getState()
  });
}

function createStageViewActionResult(input: {
  readonly result?: RuntimePlayerStageViewActionResult["result"];
  readonly message: string;
  readonly status: RuntimePlayerStageStateSnapshot;
}): RuntimePlayerStageViewActionResult {
  return {
    result: input.result ?? "ok",
    message: input.message,
    status: input.status,
    atIso: new Date().toISOString()
  };
}
