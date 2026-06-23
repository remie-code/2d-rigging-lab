import { clipboard, ipcMain, type BrowserWindow } from "electron";

import { stageViewBridgeChannels } from "../preload/stage-view-bridge-channels";
import type {
  RuntimePlayerStageArrangeState,
  RuntimePlayerStageCaptureState,
  RuntimePlayerStageStateSnapshot,
  RuntimePlayerStageViewActionResult,
  RuntimePlayerStageViewStatus,
  RuntimePlayerStageViewTransform
} from "../preload/runtime-player-bridge-contract";
import { runtimePlayerStageWindowTitle } from "../preload/runtime-player-bridge-contract";
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
  readonly onCaptureStateChanged?: () => void;
}

export interface RuntimePlayerStageViewBridgeRegistration {
  readonly statusState: RuntimePlayerStageViewStatusState;
  getCaptureState(): RuntimePlayerStageCaptureState;
  disableClickThrough(): boolean;
}

export function registerStageViewBridgeHandlers(
  input: RegisterStageViewBridgeHandlersInput
): RuntimePlayerStageViewBridgeRegistration {
  const statusState = input.state ?? new RuntimePlayerStageViewStatusState();
  const mutableCaptureState = {
    arrangeModeEnabled: false,
    clickThroughEnabled: false
  };
  const getState = (): RuntimePlayerStageStateSnapshot =>
    createStageStateSnapshot(input, statusState.getStatus(), mutableCaptureState);
  const getArrangeState = (): RuntimePlayerStageArrangeState => ({
    arrangeModeEnabled: mutableCaptureState.arrangeModeEnabled
  });
  const publishState = (): void => {
    sendToWindow(
      input.windows.controlWindow,
      stageViewBridgeChannels.stateChanged,
      getState()
    );
  };
  const publishArrangeState = (): void => {
    sendToWindow(
      input.windows.stageWindow,
      stageViewBridgeChannels.arrangeStateChanged,
      getArrangeState()
    );
  };
  const publishCaptureState = (): void => {
    publishState();
    publishArrangeState();
    input.onCaptureStateChanged?.();
  };

  applyStageClickThrough(input.windows.stageWindow, false);
  applyStageAlwaysOnTop(
    input.windows.stageWindow,
    input.windowState.getStageAlwaysOnTop()
  );

  input.windowState.subscribe(publishState);

  ipcMain.handle(stageViewBridgeChannels.getStatus, () => statusState.getStatus());
  ipcMain.handle(stageViewBridgeChannels.getState, () => getState());
  ipcMain.handle(stageViewBridgeChannels.getArrangeState, () =>
    getArrangeState()
  );
  ipcMain.handle(stageViewBridgeChannels.getViewTransform, () =>
    input.windowState.getStageViewTransform()
  );
  ipcMain.handle(stageViewBridgeChannels.reportStatus, (_event, report: unknown) => {
    const status = statusState.setReportedStatus(report);
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
  ipcMain.handle(stageViewBridgeChannels.setArrangeMode, (_event, enabled) =>
    setArrangeModeEnabled({
      input,
      mutableCaptureState,
      getState,
      publishCaptureState,
      enabled: readIpcBoolean(enabled)
    })
  );
  ipcMain.handle(stageViewBridgeChannels.setClickThrough, (_event, enabled) =>
    setClickThroughEnabled({
      input,
      mutableCaptureState,
      getState,
      publishCaptureState,
      enabled: readIpcBoolean(enabled),
      source: "control"
    })
  );
  ipcMain.handle(stageViewBridgeChannels.setAlwaysOnTop, (_event, enabled) =>
    setAlwaysOnTopEnabled({
      input,
      getState,
      publishState,
      enabled: readIpcBoolean(enabled)
    })
  );
  ipcMain.handle(stageViewBridgeChannels.copyWindowTitle, () =>
    copyStageWindowTitle(input, getState)
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

  return {
    statusState,
    getCaptureState: () =>
      createRuntimePlayerStageCaptureState(input, mutableCaptureState),
    disableClickThrough: () => {
      if (!mutableCaptureState.clickThroughEnabled) {
        return false;
      }

      setClickThroughEnabled({
        input,
        mutableCaptureState,
        getState,
        publishCaptureState,
        enabled: false,
        source: "recovery"
      });
      return true;
    }
  };
}

function sendToWindow(
  window: BrowserWindow,
  channel: string,
  payload: RuntimePlayerStageViewStatus |
    RuntimePlayerStageStateSnapshot |
    RuntimePlayerStageViewTransform |
    RuntimePlayerStageArrangeState
): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(channel, payload);
}

function createStageStateSnapshot(
  input: RegisterStageViewBridgeHandlersInput,
  renderStatus: RuntimePlayerStageViewStatus,
  mutableCaptureState: {
    readonly arrangeModeEnabled: boolean;
    readonly clickThroughEnabled: boolean;
  }
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
    persistence: input.windowState.getPersistenceSnapshot(),
    capture: createRuntimePlayerStageCaptureState(input, mutableCaptureState)
  };
}

function createRuntimePlayerStageCaptureState(
  input: RegisterStageViewBridgeHandlersInput,
  mutableCaptureState: {
    readonly arrangeModeEnabled: boolean;
    readonly clickThroughEnabled: boolean;
  }
): RuntimePlayerStageCaptureState {
  return {
    arrangeModeEnabled: mutableCaptureState.arrangeModeEnabled,
    clickThroughEnabled: mutableCaptureState.clickThroughEnabled,
    alwaysOnTopEnabled: input.windowState.getStageAlwaysOnTop(),
    windowTitle: runtimePlayerStageWindowTitle,
    background: "transparent",
    stageUi: mutableCaptureState.arrangeModeEnabled
      ? "arrange-overlay-visible"
      : "hidden"
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

function setArrangeModeEnabled(input: {
  readonly input: RegisterStageViewBridgeHandlersInput;
  readonly mutableCaptureState: {
    arrangeModeEnabled: boolean;
    clickThroughEnabled: boolean;
  };
  readonly getState: () => RuntimePlayerStageStateSnapshot;
  readonly publishCaptureState: () => void;
  readonly enabled: boolean;
}): RuntimePlayerStageViewActionResult {
  const stageWindow = input.input.windows.stageWindow;

  if (stageWindow.isDestroyed()) {
    return createStageViewActionResult({
      result: "error",
      message: "Stage Window is not available.",
      status: input.getState()
    });
  }

  let message = input.enabled
    ? "Stage arrange mode enabled."
    : "Stage arrange mode disabled.";
  let changed = input.mutableCaptureState.arrangeModeEnabled !== input.enabled;

  if (input.enabled && input.mutableCaptureState.clickThroughEnabled) {
    input.mutableCaptureState.clickThroughEnabled = false;
    applyStageClickThrough(stageWindow, false);
    changed = true;
    message = "Stage arrange mode enabled; click-through disabled.";
  }

  input.mutableCaptureState.arrangeModeEnabled = input.enabled;

  if (changed) {
    input.publishCaptureState();
  }

  return createStageViewActionResult({
    message,
    status: input.getState()
  });
}

function setClickThroughEnabled(input: {
  readonly input: RegisterStageViewBridgeHandlersInput;
  readonly mutableCaptureState: {
    arrangeModeEnabled: boolean;
    clickThroughEnabled: boolean;
  };
  readonly getState: () => RuntimePlayerStageStateSnapshot;
  readonly publishCaptureState: () => void;
  readonly enabled: boolean;
  readonly source: "control" | "recovery";
}): RuntimePlayerStageViewActionResult {
  const stageWindow = input.input.windows.stageWindow;

  if (input.enabled && stageWindow.isDestroyed()) {
    return createStageViewActionResult({
      result: "error",
      message: "Stage Window is not available.",
      status: input.getState()
    });
  }

  let changed = input.mutableCaptureState.clickThroughEnabled !== input.enabled;
  let message = input.enabled
    ? "Stage click-through enabled."
    : "Stage click-through disabled.";

  if (input.enabled && input.mutableCaptureState.arrangeModeEnabled) {
    input.mutableCaptureState.arrangeModeEnabled = false;
    changed = true;
    message = "Stage click-through enabled; arrange mode disabled.";
  }

  input.mutableCaptureState.clickThroughEnabled = input.enabled;

  if (!stageWindow.isDestroyed()) {
    applyStageClickThrough(stageWindow, input.enabled);
  }

  if (changed) {
    input.publishCaptureState();
  }

  return createStageViewActionResult({
    message: input.source === "recovery"
      ? "Stage click-through disabled from recovery menu."
      : message,
    status: input.getState()
  });
}

function setAlwaysOnTopEnabled(input: {
  readonly input: RegisterStageViewBridgeHandlersInput;
  readonly getState: () => RuntimePlayerStageStateSnapshot;
  readonly publishState: () => void;
  readonly enabled: boolean;
}): RuntimePlayerStageViewActionResult {
  const stageWindow = input.input.windows.stageWindow;

  if (stageWindow.isDestroyed()) {
    return createStageViewActionResult({
      result: "error",
      message: "Stage Window is not available.",
      status: input.getState()
    });
  }

  applyStageAlwaysOnTop(stageWindow, input.enabled);
  input.input.windowState.updateStageAlwaysOnTop(input.enabled);
  input.publishState();

  return createStageViewActionResult({
    message: input.enabled
      ? "Stage always-on-top enabled."
      : "Stage always-on-top disabled.",
    status: input.getState()
  });
}

function copyStageWindowTitle(
  input: RegisterStageViewBridgeHandlersInput,
  getState: () => RuntimePlayerStageStateSnapshot
): RuntimePlayerStageViewActionResult {
  clipboard.writeText(runtimePlayerStageWindowTitle);

  return createStageViewActionResult({
    message: `Stage window title copied: ${runtimePlayerStageWindowTitle}`,
    status: getState()
  });
}

function applyStageClickThrough(
  stageWindow: BrowserWindow,
  enabled: boolean
): void {
  if (stageWindow.isDestroyed()) {
    return;
  }

  stageWindow.setIgnoreMouseEvents(enabled);
}

function applyStageAlwaysOnTop(
  stageWindow: BrowserWindow,
  enabled: boolean
): void {
  if (stageWindow.isDestroyed()) {
    return;
  }

  stageWindow.setAlwaysOnTop(enabled);
}

function readIpcBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new Error("Stage view boolean action payload must be a boolean.");
  }

  return value;
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
