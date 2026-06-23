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
import { RuntimePlayerStartupStateStore } from "./startup-state/runtime-player-startup-state-store";
import { RuntimePlayerWindowStateController } from "./window-state/window-state-controller";
import { RuntimePlayerWindowStateStore } from "./window-state/window-state-store";
import {
  attachRuntimePlayerWindowStateTracking,
  createRuntimePlayerWindows,
  loadRuntimePlayerWindows
} from "./window-management/runtime-player-windows";
import {
  RuntimePlayerQuitController,
  attachRuntimePlayerControlWindowRecovery,
  focusRuntimePlayerStageWindow,
  showRuntimePlayerControlWindow
} from "./window-management/control-window-recovery";
import { registerRuntimePlayerTrayMenu } from "./window-management/runtime-player-tray-menu";
import type { RuntimePlayerTrayMenuRegistration } from "./window-management/runtime-player-tray-menu";

export function startRuntimePlayerMain(): void {
  let isRuntimePlayerQuitInProgress = (): boolean => false;
  let requestRuntimePlayerQuit = (): void => {
    app.quit();
  };

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
    let trayMenu: RuntimePlayerTrayMenuRegistration | null = null;
    const stageViewBridge = registerStageViewBridgeHandlers({
      windows,
      windowState,
      onCaptureStateChanged: () => {
        trayMenu?.refresh();
      }
    });
    const liveParameters = registerLiveParameterBridgeHandlers({ windows });
    const liveMappingState = new RuntimePlayerLiveMappingState();
    const bodyFollowState = new RuntimePlayerBodyFollowState();
    const modelMappingProfileStore = new ModelMappingProfileStore({
      userDataPath: app.getPath("userData")
    });
    const startupStateStore = new RuntimePlayerStartupStateStore({
      userDataPath: app.getPath("userData")
    });
    let publishLatestParameterFrame = async (): Promise<void> => {};
    let publishMappingStatus = (): void => {};
    let clearLiveParameterFrame = (): void => {
      liveParameters.clear();
    };
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
      startupStateStore,
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
    const quitController = new RuntimePlayerQuitController({
      quit: () => {
        app.quit();
      },
      disconnectInput: () => inputBridge.disconnect(),
      flushModelMappingProfile: () =>
        modelMappingBridge.flushPendingProfileSave(),
      flushWindowState: () => windowState.flush()
    });
    isRuntimePlayerQuitInProgress = () => quitController.isQuitInProgress();
    requestRuntimePlayerQuit = () => {
      quitController.requestQuit();
    };
    app.on("before-quit", (event) => {
      void quitController.handleBeforeQuit(event);
    });
    attachRuntimePlayerControlWindowRecovery({
      controlWindow: windows.controlWindow,
      isExplicitQuitInProgress: () => quitController.isQuitInProgress()
    });
    trayMenu = registerRuntimePlayerTrayMenu({
      actions: {
        showControl: () =>
          showRuntimePlayerControlWindow(windows.controlWindow),
        focusStage: () => focusRuntimePlayerStageWindow(windows.stageWindow),
        disableClickThrough: () => stageViewBridge.disableClickThrough(),
        quit: () => {
          quitController.requestQuit();
        }
      },
      getClickThroughRecoveryState: () => ({
        enabled: stageViewBridge.getCaptureState().clickThroughEnabled
      })
    });
    await loadRuntimePlayerWindows(windows);

    app.on("activate", () => {
      showRuntimePlayerControlWindow(windows.controlWindow);
    });

    app.once("will-quit", () => {
      trayMenu?.dispose();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && !isRuntimePlayerQuitInProgress()) {
      requestRuntimePlayerQuit();
    }
  });
}
