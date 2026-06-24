import { app } from "electron";

import { registerBrowserSourceBridgeHandlers } from "./broadcast-source/browser-source-bridge-handlers";
import { RuntimePlayerBrowserSourceConfigStore } from "./broadcast-source/browser-source-config-store";
import { RuntimePlayerBrowserSourceServer } from "./broadcast-source/browser-source-server";
import { LocalPreviewLiveRenderSuspensionPolicy } from "./broadcast-source/local-preview-live-render-suspension";
import type { TrackingFrame } from "../preload/input-tracking-frame-contract";
import type {
  RuntimePlayerInputSessionNeutralSnapshot
} from "../preload/input-profile-bridge-contract";
import type {
  RuntimePlayerStageViewTransform
} from "../preload/runtime-player-bridge-contract";
import { registerInputBridgeHandlers } from "./input-bridge-handlers";
import { registerInputProfileBridgeHandlers } from "./input-profile-bridge-handlers";
import type { InputProfile } from "./input-profiles/input-profile-document";
import { registerLiveParameterBridgeHandlers } from "./live-parameter-bridge-handlers";
import { RuntimePlayerBodyFollowState } from "./live-mapping/body-follow-state";
import { RuntimePlayerLiveMappingState } from "./live-mapping/live-mapping-state";
import { registerModelMappingBridgeHandlers } from "./model-mapping-bridge-handlers";
import { ModelMappingProfileStore } from "./model-mapping-profiles/model-mapping-profile-store";
import { registerPlaceholderBridgeHandlers } from "./placeholder-bridge-handlers";
import { registerRuntimeExportBridgeHandlers } from "./runtime-export-loader/runtime-export-bridge-handlers";
import { registerRuntimeVariantBridgeHandlers } from "./variant-controller/runtime-variant-bridge-handlers";
import {
  registerStageViewBridgeHandlers,
  type RuntimePlayerStageViewBridgeRegistration
} from "./stage-view-bridge-handlers";
import { RuntimePlayerStageMotionRuntime } from "./stage-motion/stage-motion-runtime";
import {
  publishRuntimePlayerStageMotionDisplayState
} from "./stage-motion/stage-motion-transport";
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
    const runtimeVariantBridge = registerRuntimeVariantBridgeHandlers({
      windows
    });
    const unsubscribeRuntimeVariantBridge =
      runtimeVariantBridge.onStatusChanged((status) => {
        browserSourceServer.publishActiveVariantSelection(
          status.activeVariantSelection
        );
      });
    const stageMotionRuntime = new RuntimePlayerStageMotionRuntime();
    let stageViewBridge: RuntimePlayerStageViewBridgeRegistration | null = null;
    let isLocalPreviewLiveRenderSuspended = false;
    let latestNativeStageDisplayTransform: RuntimePlayerStageViewTransform | null =
      null;
    let getLatestTrackingFrameForStageMotion = (): TrackingFrame | null => null;
    let getSessionNeutralForStageMotion =
      (): RuntimePlayerInputSessionNeutralSnapshot | null => null;
    let getActiveInputProfileForStageMotion:
      () => Promise<InputProfile | null> = async () => null;
    const getStageWindowBoundsForBrowserSource = () =>
      windows.stageWindow.isDestroyed()
        ? null
        : windows.stageWindow.getBounds();
    const publishStageMotionTransport = (input: {
      readonly browserSourceTransform: RuntimePlayerStageViewTransform;
      readonly nativeDisplayTransform: RuntimePlayerStageViewTransform | null;
      readonly notify?: "immediate" | "sampled";
    }): void => {
      publishRuntimePlayerStageMotionDisplayState({
        browserSourceTransform: input.browserSourceTransform,
        nativeDisplayTransform: input.nativeDisplayTransform,
        stageWindowBounds: getStageWindowBoundsForBrowserSource(),
        deliverToNativeStageWindow:
          stageViewBridge !== null && !isLocalPreviewLiveRenderSuspended,
        ...(input.notify === undefined ? {} : { notify: input.notify }),
        publishBrowserSourceStageDisplayState: (state, options) => {
          browserSourceServer.publishStageDisplayState(state, options);
        },
        publishNativeStageDisplayTransform: (transform) => {
          stageViewBridge?.publishDisplayViewTransform(transform);
        }
      });
    };
    const publishNativeStageDisplayTransform = (): void => {
      if (stageViewBridge === null || isLocalPreviewLiveRenderSuspended) {
        return;
      }

      stageViewBridge.publishDisplayViewTransform(
        latestNativeStageDisplayTransform
      );
    };
    const publishLatestStageMotionDisplayState = async (input: {
      readonly notify?: "immediate" | "sampled";
    } = {}): Promise<void> => {
      const trackingFrame = getLatestTrackingFrameForStageMotion();
      const inputProfile = await getActiveInputProfileForStageMotion();
      const result = stageMotionRuntime.update({
        baseTransform: windowState.getStageViewTransform(),
        settings: windowState.getStageMotionSettings(),
        trackingFrame,
        inputProfile,
        sessionNeutral: inputBridgeSessionNeutralForStageMotion()
      });

      latestNativeStageDisplayTransform = result.nativeDisplayTransform;
      publishStageMotionTransport({
        browserSourceTransform: result.browserSourceTransform,
        nativeDisplayTransform: result.nativeDisplayTransform,
        ...(input.notify === undefined ? {} : { notify: input.notify })
      });
    };
    const clearStageMotionDisplayTransform = (input: {
      readonly notify?: "immediate" | "sampled";
    } = {}): void => {
      stageMotionRuntime.reset();
      latestNativeStageDisplayTransform = null;
      publishStageMotionTransport({
        browserSourceTransform: windowState.getStageViewTransform(),
        nativeDisplayTransform: null,
        ...(input.notify === undefined ? {} : { notify: input.notify })
      });
    };
    const inputBridgeSessionNeutralForStageMotion = () =>
      getSessionNeutralForStageMotion();
    const unsubscribeBrowserSourceStageDisplayState =
      windowState.subscribe(() => {
        void publishLatestStageMotionDisplayState({
          notify: "immediate"
        });
      });
    clearStageMotionDisplayTransform({ notify: "immediate" });
    await browserSourceServer.start().catch(() => undefined);
    let trayMenu: RuntimePlayerTrayMenuRegistration | null = null;
    stageViewBridge = registerStageViewBridgeHandlers({
      windows,
      windowState,
      onCaptureStateChanged: () => {
        trayMenu?.refresh();
      },
      onStageMotionSettingsChanged: () => {
        stageMotionRuntime.reset();
        void publishLatestStageMotionDisplayState({
          notify: "immediate"
        });
      }
    });
    const stageLiveParameters = registerLiveParameterBridgeHandlers({ windows });
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
            stageViewBridge?.publishDisplayViewTransform(null);
            return;
          }

          stageLiveParameters.publishLatestFrameToStageWindow({
            resetBeforePublish: true
          });
          publishNativeStageDisplayTransform();
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
        void publishLatestStageMotionDisplayState({
          notify: "sampled"
        });
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
        clearStageMotionDisplayTransform({
          notify: "immediate"
        });
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
        stageMotionRuntime.reset();
        clearLiveParameterFrame();
      }
    });
    getLatestTrackingFrameForStageMotion = () =>
      inputBridge.state.getLatestTrackingFrame();
    getSessionNeutralForStageMotion = () =>
      inputBridge.state.getSessionNeutral();
    const inputProfileBridge = registerInputProfileBridgeHandlers({
      windows,
      inputState: inputBridge.state,
      userDataPath: app.getPath("userData"),
      onProfileChanged: () => {
        bodyFollowState.reset();
        stageMotionRuntime.reset();
        void publishLatestStageMotionDisplayState({
          notify: "immediate"
        });
        return publishLatestParameterFrame();
      }
    });
    getActiveInputProfileForStageMotion =
      inputProfileBridge.getActiveInputProfile;
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
        runtimeVariantBridge.clearRuntimeExport();
        clearLiveParameterFrame();
        browserSourceServer.clearRuntimeExport("Runtime Export changing");
        publishMappingStatus();
      },
      onRuntimeExportLoaded: async (payload) => {
        bodyFollowState.reset();
        await modelMappingBridge.setRuntimeExportPayload(payload);
        const variantStatus =
          runtimeVariantBridge.setRuntimeExportPayload(payload);
        clearLiveParameterFrame();
        browserSourceServer.publishRuntimeExportLoaded(
          payload,
          variantStatus.activeVariantSelection
        );
        publishMappingStatus();
        void publishLatestParameterFrame();
      },
      onRuntimeExportCleared: async () => {
        await modelMappingBridge.flushPendingProfileSave();
        bodyFollowState.reset();
        modelMappingBridge.clearRuntimeExport();
        runtimeVariantBridge.clearRuntimeExport();
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
        disableClickThrough: () => stageViewBridge?.disableClickThrough() ??
          false,
        quit: () => {
          quitController.requestQuit();
        }
      },
      getClickThroughRecoveryState: () => ({
        enabled: stageViewBridge?.getCaptureState().clickThroughEnabled ?? false
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
      unsubscribeRuntimeVariantBridge();
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
