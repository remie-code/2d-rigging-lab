import { contextBridge, ipcRenderer } from "electron";

import {
  type RuntimePlayerApi,
  type RuntimePlayerPlaceholderAction,
  runtimePlayerPlaceholderActions
} from "./runtime-player-bridge-contract";
import { placeholderBridgeChannels } from "./placeholder-bridge-channels";

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
