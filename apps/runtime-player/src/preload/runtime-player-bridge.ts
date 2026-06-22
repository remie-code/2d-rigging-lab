import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import {
  type RuntimePlayerApi,
  type RuntimePlayerStageViewStatus,
  type RuntimePlayerPlaceholderAction,
  runtimePlayerPlaceholderActions
} from "./runtime-player-bridge-contract";
import { placeholderBridgeChannels } from "./placeholder-bridge-channels";
import { runtimeExportBridgeChannels } from "./runtime-export-bridge-channels";
import { stageViewBridgeChannels } from "./stage-view-bridge-channels";
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
