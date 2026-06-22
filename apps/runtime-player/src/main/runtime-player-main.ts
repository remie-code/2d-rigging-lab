import { app } from "electron";

import { registerInputBridgeHandlers } from "./input-bridge-handlers";
import { registerInputProfileBridgeHandlers } from "./input-profile-bridge-handlers";
import { registerLiveParameterBridgeHandlers } from "./live-parameter-bridge-handlers";
import { RuntimePlayerLiveMappingState } from "./live-mapping/live-mapping-state";
import { registerModelMappingBridgeHandlers } from "./model-mapping-bridge-handlers";
import { registerPlaceholderBridgeHandlers } from "./placeholder-bridge-handlers";
import { registerRuntimeExportBridgeHandlers } from "./runtime-export-loader/runtime-export-bridge-handlers";
import { registerStageViewBridgeHandlers } from "./stage-view-bridge-handlers";
import {
  createRuntimePlayerWindows,
  loadRuntimePlayerWindows
} from "./window-management/runtime-player-windows";

export function startRuntimePlayerMain(): void {
  app.whenReady().then(async () => {
    const windows = createRuntimePlayerWindows();
    registerPlaceholderBridgeHandlers({ windows });
    registerStageViewBridgeHandlers({ windows });
    const liveParameters = registerLiveParameterBridgeHandlers({ windows });
    const liveMappingState = new RuntimePlayerLiveMappingState();
    let publishLatestParameterFrame = async (): Promise<void> => {};
    let publishMappingStatus = (): void => {};
    let clearLiveParameterFrame = (): void => {
      liveParameters.clear();
    };
    const inputBridge = registerInputBridgeHandlers({
      windows,
      onTrackingFrame: () => publishLatestParameterFrame()
    });
    const inputProfileBridge = registerInputProfileBridgeHandlers({
      windows,
      inputState: inputBridge.state,
      userDataPath: app.getPath("userData"),
      onProfileChanged: () => publishLatestParameterFrame()
    });
    const modelMappingBridge = registerModelMappingBridgeHandlers({
      windows,
      inputState: inputBridge.state,
      mappingState: liveMappingState,
      liveParameters,
      getActiveInputProfile: inputProfileBridge.getActiveInputProfile
    });
    publishLatestParameterFrame = modelMappingBridge.publishLatestParameterFrame;
    publishMappingStatus = modelMappingBridge.publishStatus;
    clearLiveParameterFrame = modelMappingBridge.clearLiveParameterFrame;
    registerRuntimeExportBridgeHandlers({
      windows,
      onRuntimeExportChanging: () => {
        liveMappingState.clearRuntimeExport();
        clearLiveParameterFrame();
        publishMappingStatus();
      },
      onRuntimeExportLoaded: (payload) => {
        liveMappingState.setRuntimeExportPayload(payload);
        clearLiveParameterFrame();
        publishMappingStatus();
        void publishLatestParameterFrame();
      },
      onRuntimeExportCleared: () => {
        liveMappingState.clearRuntimeExport();
        clearLiveParameterFrame();
        publishMappingStatus();
      }
    });
    await loadRuntimePlayerWindows(windows);

    app.on("activate", () => {
      if (windows.controlWindow.isDestroyed()) {
        return;
      }

      windows.controlWindow.show();
      windows.controlWindow.focus();
    });

    app.on("before-quit", () => {
      void inputBridge.disconnect();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
