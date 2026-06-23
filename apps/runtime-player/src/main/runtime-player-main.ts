import { app } from "electron";

import { registerBrowserSourceBridgeHandlers } from "./broadcast-source/browser-source-bridge-handlers";
import { RuntimePlayerBrowserSourceConfigStore } from "./broadcast-source/browser-source-config-store";
import { RuntimePlayerBrowserSourceServer } from "./broadcast-source/browser-source-server";
import { LocalPreviewLiveRenderSuspensionPolicy } from "./broadcast-source/local-preview-live-render-suspension";
import type {
  RuntimePlayerBrowserSourceStageDisplayState
} from "../preload/browser-source-status-contract";
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
    const browserSourceConfigStore = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath: app.getPath("userData")
    });
    const browserSourceConfig =
      await browserSourceConfigStore.getOrCreateConfig();
    const browserSourceServer = new RuntimePlayerBrowserSourceServer({
      port: browserSourceConfig.preferredPort,
      token: browserSourceConfig.token
    });
    const browserSourceBridge = registerBrowserSourceBridgeHandlers({
      windows,
      statusProvider: browserSourceServer
    });
    const publishBrowserSourceStageDisplayState = (): void => {
      browserSourceServer.publishStageDisplayState(
        createBrowserSourceStageDisplayState({
          windows,
          windowState
        })
      );
    };
    const unsubscribeBrowserSourceStageDisplayState =
      windowState.subscribe(publishBrowserSourceStageDisplayState);
    publishBrowserSourceStageDisplayState();
    await browserSourceServer.start().catch(() => undefined);
    let trayMenu: RuntimePlayerTrayMenuRegistration | null = null;
    const stageViewBridge = registerStageViewBridgeHandlers({
      windows,
      windowState,
      onCaptureStateChanged: () => {
        trayMenu?.refresh();
      }
    });
    const stageLiveParameters = registerLiveParameterBridgeHandlers({ windows });
    let isLocalPreviewLiveRenderSuspended = false;
    const localPreviewLiveRenderPolicy =
      new LocalPreviewLiveRenderSuspensionPolicy({
        onStateChanged: (state) => {
          if (state.suspended === isLocalPreviewLiveRenderSuspended) {
            return;
          }

          isLocalPreviewLiveRenderSuspended = state.suspended;
          stageLiveParameters.setStageWindowLiveFrameDeliveryEnabled(
            !state.suspended
          );

          if (state.suspended) {
            stageLiveParameters.clearStageWindowLiveParameterFrame();
            return;
          }

          stageLiveParameters.publishLatestFrameToStageWindow({
            resetBeforePublish: true
          });
        }
      });
    const unsubscribeLocalPreviewLiveRenderPolicy =
      browserSourceServer.onStatusChanged((status) => {
        localPreviewLiveRenderPolicy.updateConnectedClientCount(
          status.connectedClientCount
        );
      });
    localPreviewLiveRenderPolicy.updateConnectedClientCount(
      browserSourceServer.getStatus().connectedClientCount
    );
    const liveParameters = {
      getLatestFrame: stageLiveParameters.getLatestFrame,
      publishFrame: (frame: Parameters<typeof stageLiveParameters.publishFrame>[0]) => {
        stageLiveParameters.publishFrame(frame, {
          deliverToStageWindow: !localPreviewLiveRenderPolicy.isSuspended()
        });
        browserSourceServer.publishLiveParameterFrame(frame);
      },
      publishLatestFrameToStageWindow:
        stageLiveParameters.publishLatestFrameToStageWindow,
      setStageWindowLiveFrameDeliveryEnabled:
        stageLiveParameters.setStageWindowLiveFrameDeliveryEnabled,
      clearStageWindowLiveParameterFrame:
        stageLiveParameters.clearStageWindowLiveParameterFrame,
      clear: () => {
        stageLiveParameters.clear();
        browserSourceServer.clearLatestFrame();
      }
    };
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
        browserSourceServer.clearRuntimeExport("Runtime Export changing");
        publishMappingStatus();
      },
      onRuntimeExportLoaded: async (payload) => {
        bodyFollowState.reset();
        await modelMappingBridge.setRuntimeExportPayload(payload);
        clearLiveParameterFrame();
        browserSourceServer.publishRuntimeExportLoaded(payload);
        publishMappingStatus();
        void publishLatestParameterFrame();
      },
      onRuntimeExportCleared: async () => {
        await modelMappingBridge.flushPendingProfileSave();
        bodyFollowState.reset();
        modelMappingBridge.clearRuntimeExport();
        clearLiveParameterFrame();
        browserSourceServer.clearRuntimeExport("No Runtime Export loaded");
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
      localPreviewLiveRenderPolicy.dispose();
      unsubscribeLocalPreviewLiveRenderPolicy();
      unsubscribeBrowserSourceStageDisplayState();
      browserSourceBridge.dispose();
      void browserSourceServer.stop();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin" && !isRuntimePlayerQuitInProgress()) {
      requestRuntimePlayerQuit();
    }
  });
}

function createBrowserSourceStageDisplayState(input: {
  readonly windows: ReturnType<typeof createRuntimePlayerWindows>;
  readonly windowState: RuntimePlayerWindowStateController;
}): {
  readonly stageWindow: RuntimePlayerBrowserSourceStageDisplayState["stageWindow"];
  readonly stageView: RuntimePlayerBrowserSourceStageDisplayState["stageView"];
} {
  return {
    stageWindow: {
      bounds: input.windows.stageWindow.isDestroyed()
        ? null
        : input.windows.stageWindow.getBounds()
    },
    stageView: {
      transform: input.windowState.getStageViewTransform()
    }
  };
}
