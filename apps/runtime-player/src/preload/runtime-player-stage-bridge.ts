import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import { liveParameterBridgeChannels } from "./live-parameter-bridge-channels";
import { runtimeExportBridgeChannels } from "./runtime-export-bridge-channels";
import { runtimeVariantBridgeChannels } from "./runtime-variant-bridge-channels";
import { stageViewBridgeChannels } from "./stage-view-bridge-channels";
import type { RuntimePlayerLiveParameterFrame } from "./live-parameter-bridge-contract";
import type {
  RuntimePlayerStageApi
} from "./runtime-player-stage-bridge-contract";
import type {
  RuntimePlayerStageArrangeState,
  RuntimePlayerStageViewTransform
} from "./runtime-player-bridge-contract";
import type {
  RuntimeExportLoadedPayload,
  RuntimeExportStatus
} from "./runtime-export-bridge-contract";
import type {
  RuntimePlayerVariantControllerStatus
} from "./runtime-variant-bridge-contract";

export function installRuntimePlayerStageBridge(): void {
  const runtimePlayerStageApi: RuntimePlayerStageApi = {
    runtimeExport: {
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
    variants: {
      getStatus: () =>
        ipcRenderer.invoke(runtimeVariantBridgeChannels.getStatus),
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
      getViewTransform: () =>
        ipcRenderer.invoke(stageViewBridgeChannels.getViewTransform),
      getArrangeState: () =>
        ipcRenderer.invoke(stageViewBridgeChannels.getArrangeState),
      reportStatus: (status) =>
        ipcRenderer.invoke(stageViewBridgeChannels.reportStatus, status),
      reportViewTransform: (transform) =>
        ipcRenderer.invoke(
          stageViewBridgeChannels.reportViewTransform,
          transform
        ),
      onApplyViewTransformRequested: (callback) =>
        subscribeToStageViewTransformEvent(
          stageViewBridgeChannels.applyViewTransformRequested,
          callback
        ),
      onApplyDisplayViewTransformRequested: (callback) =>
        subscribeToStageViewDisplayTransformEvent(
          stageViewBridgeChannels.applyDisplayViewTransformRequested,
          callback
        ),
      onArrangeStateChanged: (callback) =>
        subscribeToStageArrangeStateEvent(
          stageViewBridgeChannels.arrangeStateChanged,
          callback
        )
    }
  };

  contextBridge.exposeInMainWorld("runtimePlayerStage", runtimePlayerStageApi);
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

function subscribeToStageViewDisplayTransformEvent(
  channel: string,
  callback: (payload: RuntimePlayerStageViewTransform | null) => void
): () => void {
  const listener = (
    _event: IpcRendererEvent,
    payload: RuntimePlayerStageViewTransform | null
  ) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

function subscribeToStageArrangeStateEvent(
  channel: string,
  callback: (payload: RuntimePlayerStageArrangeState) => void
): () => void {
  const listener = (
    _event: IpcRendererEvent,
    payload: RuntimePlayerStageArrangeState
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
