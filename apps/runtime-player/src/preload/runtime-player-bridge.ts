import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import {
  type RuntimePlayerApi,
  type RuntimePlayerStageViewStatus,
  type RuntimePlayerPlaceholderAction,
  runtimePlayerPlaceholderActions
} from "./runtime-player-bridge-contract";
import { inputBridgeChannels } from "./input-bridge-channels";
import { inputProfileBridgeChannels } from "./input-profile-bridge-channels";
import { liveParameterBridgeChannels } from "./live-parameter-bridge-channels";
import { modelMappingBridgeChannels } from "./model-mapping-bridge-channels";
import { placeholderBridgeChannels } from "./placeholder-bridge-channels";
import { runtimeExportBridgeChannels } from "./runtime-export-bridge-channels";
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
  RuntimeExportStatus
} from "./runtime-export-bridge-contract";

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
      updateSlot: (request) =>
        ipcRenderer.invoke(modelMappingBridgeChannels.updateSlot, request),
      onStatusChanged: (callback) =>
        subscribeToModelMappingEvent(
          modelMappingBridgeChannels.statusChanged,
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
      reportStatus: (status) =>
        ipcRenderer.invoke(stageViewBridgeChannels.reportStatus, status),
      onStatusChanged: (callback) =>
        subscribeToStageViewStatusEvent(
          stageViewBridgeChannels.statusChanged,
          callback
        ),
      onResetViewRequested: (callback) =>
        subscribeToVoidEvent(stageViewBridgeChannels.resetRequested, callback)
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
    focusStage: () => ipcRenderer.invoke(placeholderBridgeChannels.focusStage),
    resetStagePosition: () =>
      ipcRenderer.invoke(placeholderBridgeChannels.resetStagePosition)
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
