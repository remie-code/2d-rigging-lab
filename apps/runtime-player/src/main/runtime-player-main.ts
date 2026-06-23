import { app } from "electron";

import { registerInputBridgeHandlers } from "./input-bridge-handlers";
import { registerInputProfileBridgeHandlers } from "./input-profile-bridge-handlers";
import { registerLiveParameterBridgeHandlers } from "./live-parameter-bridge-handlers";
import { RuntimePlayerBodyFollowState } from "./live-mapping/body-follow-state";
import { RuntimePlayerLiveMappingState } from "./live-mapping/live-mapping-state";
import { registerModelMappingBridgeHandlers } from "./model-mapping-bridge-handlers";
import { ModelMappingProfileStore } from "./model-mapping-profiles/model-mapping-profile-store";
import { registerPlaceholderBridgeHandlers } from "./placeholder-bridge-handlers";
import { registerRuntimeExportBridgeHandlers } from "./runtime-export-loader/runtime-export-bridge-handlers";
import { registerStageViewBridgeHandlers } from "./stage-view-bridge-handlers";
import { RuntimePlayerWindowStateController } from "./window-state/window-state-controller";
import { RuntimePlayerWindowStateStore } from "./window-state/window-state-store";
import {
  attachRuntimePlayerWindowStateTracking,
  createRuntimePlayerWindows,
  loadRuntimePlayerWindows
} from "./window-management/runtime-player-windows";

export function startRuntimePlayerMain(): void {
  app.whenReady().then(async () => {
    const windowStateStore = new RuntimePlayerWindowStateStore({
      userDataPath: app.getPath("userData")
    });
    const windowStateSnapshot = await windowStateStore.getSnapshot();
    const windowState = new RuntimePlayerWindowStateController({
      store: windowStateStore,
      snapshot: windowStateSnapshot
    });
    const windows = createRuntimePlayerWindows({
      windowState: windowState.getDocument()
    });
    attachRuntimePlayerWindowStateTracking({ windows, windowState });
    registerPlaceholderBridgeHandlers({ windows });
    registerStageViewBridgeHandlers({ windows, windowState });
    const liveParameters = registerLiveParameterBridgeHandlers({ windows });
    const liveMappingState = new RuntimePlayerLiveMappingState();
    const bodyFollowState = new RuntimePlayerBodyFollowState();
    const modelMappingProfileStore = new ModelMappingProfileStore({
      userDataPath: app.getPath("userData")
    });
    let publishLatestParameterFrame = async (): Promise<void> => {};
    let publishMappingStatus = (): void => {};
    let clearLiveParameterFrame = (): void => {
      liveParameters.clear();
    };
    let quitAfterFlush = false;
    const inputBridge = registerInputBridgeHandlers({
      windows,
      onTrackingFrame: () => publishLatestParameterFrame(),
      onInputReset: () => {
        bodyFollowState.reset();
        clearLiveParameterFrame();
      }
    });
    const inputProfileBridge = registerInputProfileBridgeHandlers({
      windows,
      inputState: inputBridge.state,
      userDataPath: app.getPath("userData"),
      onProfileChanged: () => {
        bodyFollowState.reset();
        return publishLatestParameterFrame();
      }
    });
    const modelMappingBridge = registerModelMappingBridgeHandlers({
      windows,
      inputState: inputBridge.state,
      mappingState: liveMappingState,
      bodyFollowState,
      profileStore: modelMappingProfileStore,
      liveParameters,
      getActiveInputProfile: inputProfileBridge.getActiveInputProfile
    });
    publishLatestParameterFrame = modelMappingBridge.publishLatestParameterFrame;
    publishMappingStatus = modelMappingBridge.publishStatus;
    clearLiveParameterFrame = modelMappingBridge.clearLiveParameterFrame;
    registerRuntimeExportBridgeHandlers({
      windows,
      onRuntimeExportChanging: async () => {
        await modelMappingBridge.flushPendingProfileSave();
        bodyFollowState.reset();
        modelMappingBridge.clearRuntimeExport();
        clearLiveParameterFrame();
        publishMappingStatus();
      },
      onRuntimeExportLoaded: async (payload) => {
        bodyFollowState.reset();
        await modelMappingBridge.setRuntimeExportPayload(payload);
        clearLiveParameterFrame();
        publishMappingStatus();
        void publishLatestParameterFrame();
      },
      onRuntimeExportCleared: async () => {
        await modelMappingBridge.flushPendingProfileSave();
        bodyFollowState.reset();
        modelMappingBridge.clearRuntimeExport();
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

    app.on("before-quit", (event) => {
      if (quitAfterFlush) {
        return;
      }

      event.preventDefault();
      void Promise.allSettled([
        inputBridge.disconnect(),
        modelMappingBridge.flushPendingProfileSave(),
        windowState.flush()
      ]).finally(() => {
        quitAfterFlush = true;
        app.quit();
      });
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
