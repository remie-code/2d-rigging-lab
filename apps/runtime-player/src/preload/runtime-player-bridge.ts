import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import {
  type RuntimePlayerApi,
  type RuntimePlayerStageViewStatus,
  type RuntimePlayerStageStateSnapshot,
  type RuntimePlayerStageViewTransform,
  type RuntimePlayerPlaceholderAction,
  runtimePlayerPlaceholderActions
} from "./runtime-player-bridge-contract";
import { browserSourceBridgeChannels } from "./browser-source-bridge-channels";
import { inputBridgeChannels } from "./input-bridge-channels";
import { inputProfileBridgeChannels } from "./input-profile-bridge-channels";
import { liveParameterBridgeChannels } from "./live-parameter-bridge-channels";
import { modelMappingBridgeChannels } from "./model-mapping-bridge-channels";
import { placeholderBridgeChannels } from "./placeholder-bridge-channels";
import { runtimeExportBridgeChannels } from "./runtime-export-bridge-channels";
import { runtimeVariantBridgeChannels } from "./runtime-variant-bridge-channels";
import { stageViewBridgeChannels } from "./stage-view-bridge-channels";
import type {
  RuntimePlayerInputDiagnosticsSnapshot,
  RuntimePlayerInputStatus
} from "./input-bridge-contract";
import type {
  RuntimePlayerInputProfileActionResult,
  RuntimePlayerInputProfileStatus
} from "./input-profile-bridge-contract";
import type { RuntimePlayerLiveParameterFrame } from "./live-parameter-bridge-contract";
import type {
  RuntimePlayerMappingActionResult,
  RuntimePlayerMappingStatus
} from "./model-mapping-bridge-contract";
import type {
  RuntimeExportLoadedPayload,
  RuntimeExportRestoreLastDirectoryRequest,
  RuntimeExportStatus
} from "./runtime-export-bridge-contract";
import type {
  RuntimePlayerVariantControllerStatus
} from "./runtime-variant-bridge-contract";
import type {
  RuntimePlayerBrowserSourceStatus
} from "./browser-source-status-contract";

const placeholderActionSet = new Set<string>(runtimePlayerPlaceholderActions);

function assertPlaceholderAction(
  action: RuntimePlayerPlaceholderAction
): RuntimePlayerPlaceholderAction {
  if (!placeholderActionSet.has(action)) {
    throw new Error(`Unsupported Runtime Player placeholder action: ${action}`);
  }

  return action;
}

export function installRuntimePlayerBridge(): void {
  const runtimePlayerApi: RuntimePlayerApi = {
    runtimeExport: {
      getStatus: () =>
        ipcRenderer.invoke(runtimeExportBridgeChannels.getStatus),
      openDirectory: () =>
        ipcRenderer.invoke(runtimeExportBridgeChannels.openDirectory),
      restoreLastDirectory: (
        request?: RuntimeExportRestoreLastDirectoryRequest
      ) =>
        ipcRenderer.invoke(
          runtimeExportBridgeChannels.restoreLastDirectory,
          request
        ),
      getLoadedPayload: () =>
        ipcRenderer.invoke(runtimeExportBridgeChannels.getLoadedPayload),
      onStatusChanged: (callback) =>
        subscribeToRuntimeExportEvent(
          runtimeExportBridgeChannels.statusChanged,
          callback
        ),
      onLoadedPayload: (callback) =>
        subscribeToRuntimeExportEvent(
          runtimeExportBridgeChannels.loadedPayload,
          callback
        )
    },
    input: {
      getStatus: () => ipcRenderer.invoke(inputBridgeChannels.getStatus),
      connect: (request = {}) =>
        ipcRenderer.invoke(inputBridgeChannels.connect, request),
      disconnect: () => ipcRenderer.invoke(inputBridgeChannels.disconnect),
      getDiagnostics: () =>
        ipcRenderer.invoke(inputBridgeChannels.getDiagnostics),
      copyDiagnostics: () =>
        ipcRenderer.invoke(inputBridgeChannels.copyDiagnostics),
      onStatusChanged: (callback) =>
        subscribeToInputEvent(inputBridgeChannels.statusChanged, callback),
      onDiagnosticsChanged: (callback) =>
        subscribeToInputEvent(inputBridgeChannels.diagnosticsChanged, callback)
    },
    inputProfile: {
      getStatus: () =>
        ipcRenderer.invoke(inputProfileBridgeChannels.getStatus),
      setActiveProfile: (request) =>
        ipcRenderer.invoke(inputProfileBridgeChannels.setActiveProfile, request),
      useTemporaryDefaults: () =>
        ipcRenderer.invoke(inputProfileBridgeChannels.useTemporaryDefaults),
      lookForward: () =>
        ipcRenderer.invoke(inputProfileBridgeChannels.lookForward),
      startCalibration: (request = {}) =>
        ipcRenderer.invoke(
          inputProfileBridgeChannels.startCalibration,
          request
        ),
      cancelCalibration: () =>
        ipcRenderer.invoke(inputProfileBridgeChannels.cancelCalibration),
      recordCalibrationSample: () =>
        ipcRenderer.invoke(
          inputProfileBridgeChannels.recordCalibrationSample
        ),
      advanceCalibrationPrompt: () =>
        ipcRenderer.invoke(
          inputProfileBridgeChannels.advanceCalibrationPrompt
        ),
      finishCalibration: (request = {}) =>
        ipcRenderer.invoke(
          inputProfileBridgeChannels.finishCalibration,
          request
        ),
      onStatusChanged: (callback) =>
        subscribeToInputProfileEvent(
          inputProfileBridgeChannels.statusChanged,
          callback
        )
    },
    modelMapping: {
      getStatus: () =>
        ipcRenderer.invoke(modelMappingBridgeChannels.getStatus),
      regenerateAutoMapping: () =>
        ipcRenderer.invoke(modelMappingBridgeChannels.regenerateAutoMapping),
      resetToAutoMap: () =>
        ipcRenderer.invoke(modelMappingBridgeChannels.resetToAutoMap),
      retryProfileSave: () =>
        ipcRenderer.invoke(modelMappingBridgeChannels.retryProfileSave),
      updateSlot: (request) =>
        ipcRenderer.invoke(modelMappingBridgeChannels.updateSlot, request),
      onStatusChanged: (callback) =>
        subscribeToModelMappingEvent(
          modelMappingBridgeChannels.statusChanged,
          callback
        )
    },
    variants: {
      getStatus: () =>
        ipcRenderer.invoke(runtimeVariantBridgeChannels.getStatus),
      selectSingle: (request) =>
        ipcRenderer.invoke(runtimeVariantBridgeChannels.selectSingle, request),
      toggleMulti: (request) =>
        ipcRenderer.invoke(runtimeVariantBridgeChannels.toggleMulti, request),
      resetToDefault: () =>
        ipcRenderer.invoke(runtimeVariantBridgeChannels.resetToDefault),
      onStatusChanged: (callback) =>
        subscribeToRuntimeVariantEvent(
          runtimeVariantBridgeChannels.statusChanged,
          callback
        )
    },
    liveParameters: {
      getLatestFrame: () =>
        ipcRenderer.invoke(liveParameterBridgeChannels.getLatestFrame),
      onFrame: (callback) =>
        subscribeToLiveParameterFrameEvent(
          liveParameterBridgeChannels.frame,
          callback
        ),
      onCleared: (callback) =>
        subscribeToVoidEvent(liveParameterBridgeChannels.cleared, callback)
    },
    stageView: {
      getStatus: () =>
        ipcRenderer.invoke(stageViewBridgeChannels.getStatus),
      getState: () =>
        ipcRenderer.invoke(stageViewBridgeChannels.getState),
      reportStatus: (status) =>
        ipcRenderer.invoke(stageViewBridgeChannels.reportStatus, status),
      reportViewTransform: (transform) =>
        ipcRenderer.invoke(
          stageViewBridgeChannels.reportViewTransform,
          transform
        ),
      focusStage: () =>
        ipcRenderer.invoke(stageViewBridgeChannels.focusStage),
      resetView: () =>
        ipcRenderer.invoke(stageViewBridgeChannels.resetView),
      centerModel: () =>
        ipcRenderer.invoke(stageViewBridgeChannels.centerModel),
      setArrangeMode: (enabled) =>
        ipcRenderer.invoke(stageViewBridgeChannels.setArrangeMode, enabled),
      setClickThrough: (enabled) =>
        ipcRenderer.invoke(stageViewBridgeChannels.setClickThrough, enabled),
      setAlwaysOnTop: (enabled) =>
        ipcRenderer.invoke(stageViewBridgeChannels.setAlwaysOnTop, enabled),
      updateStageMotionSettings: (update) =>
        ipcRenderer.invoke(
          stageViewBridgeChannels.updateStageMotionSettings,
          update
        ),
      copyWindowTitle: () =>
        ipcRenderer.invoke(stageViewBridgeChannels.copyWindowTitle),
      getViewTransform: () =>
        ipcRenderer.invoke(stageViewBridgeChannels.getViewTransform),
      onStatusChanged: (callback) =>
        subscribeToStageViewStatusEvent(
          stageViewBridgeChannels.statusChanged,
          callback
        ),
      onStateChanged: (callback) =>
        subscribeToStageViewStateEvent(
          stageViewBridgeChannels.stateChanged,
          callback
        ),
      onApplyViewTransformRequested: (callback) =>
        subscribeToStageViewTransformEvent(
          stageViewBridgeChannels.applyViewTransformRequested,
          callback
        ),
      onResetViewRequested: (callback) =>
        subscribeToVoidEvent(stageViewBridgeChannels.resetRequested, callback)
    },
    browserSource: {
      getStatus: () =>
        ipcRenderer.invoke(browserSourceBridgeChannels.getStatus),
      onStatusChanged: (callback) =>
        subscribeToBrowserSourceStatusEvent(
          browserSourceBridgeChannels.statusChanged,
          callback
        )
    },
    getStartupStatus: () =>
      ipcRenderer.invoke(placeholderBridgeChannels.getStartupStatus),
    getStageStatus: () =>
      ipcRenderer.invoke(placeholderBridgeChannels.getStageStatus),
    performPlaceholderAction: (action) =>
      ipcRenderer.invoke(
        placeholderBridgeChannels.performPlaceholderAction,
        assertPlaceholderAction(action)
      ),
    focusStage: () => ipcRenderer.invoke(stageViewBridgeChannels.focusStage),
    resetStagePosition: () =>
      ipcRenderer.invoke(stageViewBridgeChannels.resetView)
  };

  contextBridge.exposeInMainWorld("runtimePlayer", runtimePlayerApi);
}

function subscribeToVoidEvent(
  channel: string,
  callback: () => void
): () => void {
  const listener = () => {
    callback();
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToStageViewStatusEvent(
  channel: string,
  callback: (payload: RuntimePlayerStageViewStatus) => void
): () => void {
  const listener = (
    _event: IpcRendererEvent,
    payload: RuntimePlayerStageViewStatus
  ) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToStageViewStateEvent(
  channel: string,
  callback: (payload: RuntimePlayerStageStateSnapshot) => void
): () => void {
  const listener = (
    _event: IpcRendererEvent,
    payload: RuntimePlayerStageStateSnapshot
  ) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToStageViewTransformEvent(
  channel: string,
  callback: (payload: RuntimePlayerStageViewTransform) => void
): () => void {
  const listener = (
    _event: IpcRendererEvent,
    payload: RuntimePlayerStageViewTransform
  ) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToRuntimeExportEvent<TPayload extends
  RuntimeExportLoadedPayload | RuntimeExportStatus>(
  channel: string,
  callback: (payload: TPayload) => void
): () => void {
  const listener = (_event: IpcRendererEvent, payload: TPayload) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToBrowserSourceStatusEvent(
  channel: string,
  callback: (payload: RuntimePlayerBrowserSourceStatus) => void
): () => void {
  const listener = (
    _event: IpcRendererEvent,
    payload: RuntimePlayerBrowserSourceStatus
  ) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToRuntimeVariantEvent(
  channel: string,
  callback: (payload: RuntimePlayerVariantControllerStatus) => void
): () => void {
  const listener = (
    _event: IpcRendererEvent,
    payload: RuntimePlayerVariantControllerStatus
  ) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToInputEvent<TPayload extends
  RuntimePlayerInputStatus | RuntimePlayerInputDiagnosticsSnapshot>(
  channel: string,
  callback: (payload: TPayload) => void
): () => void {
  const listener = (_event: IpcRendererEvent, payload: TPayload) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToInputProfileEvent<TPayload extends
  RuntimePlayerInputProfileStatus | RuntimePlayerInputProfileActionResult>(
  channel: string,
  callback: (payload: TPayload) => void
): () => void {
  const listener = (_event: IpcRendererEvent, payload: TPayload) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToModelMappingEvent<TPayload extends
  RuntimePlayerMappingStatus | RuntimePlayerMappingActionResult>(
  channel: string,
  callback: (payload: TPayload) => void
): () => void {
  const listener = (_event: IpcRendererEvent, payload: TPayload) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToLiveParameterFrameEvent(
  channel: string,
  callback: (payload: RuntimePlayerLiveParameterFrame) => void
): () => void {
  const listener = (
    _event: IpcRendererEvent,
    payload: RuntimePlayerLiveParameterFrame
  ) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}
